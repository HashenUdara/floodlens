"""Knowledge Library upload, lifecycle, and retrieval endpoints."""

from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.db.database import get_db_session
from app.services.document_repository import DocumentRepository, serialize_document
from app.services.document_service import (
    DocumentManagementService,
    DocumentServiceError,
    run_document_ingestion,
)
from app.services.document_storage import get_document_storage
from app.services.retrieval_service import DocumentRetrievalService

router = APIRouter(prefix="/documents", tags=["knowledge"])


class DocumentSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=2000)
    district: str | None = None
    document_types: list[str] | None = None
    document_ids: list[str] | None = None
    limit: int = Field(default=6, ge=1, le=10)


def management_service(session: Session) -> DocumentManagementService:
    return DocumentManagementService(DocumentRepository(session))


def service_error(error: DocumentServiceError) -> HTTPException:
    return HTTPException(
        status_code=error.status_code,
        detail={"message": str(error), **error.context},
    )


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File()],
    document_type: Annotated[str, Form()] = "other",
    title: Annotated[str | None, Form()] = None,
    district: Annotated[str | None, Form()] = None,
    session: Session = Depends(get_db_session),
) -> dict[str, object]:
    max_bytes = settings.max_document_size_mb * 1024 * 1024
    content = await file.read(max_bytes + 1)
    try:
        document = management_service(session).create(
            filename=file.filename or "document",
            mime_type=file.content_type or "application/octet-stream",
            content=content,
            title=title,
            document_type=document_type,
            district=district,
        )
    except DocumentServiceError as error:
        raise service_error(error) from error
    background_tasks.add_task(run_document_ingestion, str(document["id"]))
    return document


@router.get("")
def list_documents(
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    district: str | None = None,
    document_type: str | None = None,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    session: Session = Depends(get_db_session),
) -> list[dict[str, object]]:
    return management_service(session).list(
        status=status_filter,
        district=district,
        document_type=document_type,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/summary")
def document_summary(
    session: Session = Depends(get_db_session),
) -> dict[str, object]:
    return DocumentRepository(session).summary()


@router.post("/search")
def search_documents(
    payload: DocumentSearchRequest,
    session: Session = Depends(get_db_session),
) -> dict[str, object]:
    return DocumentRetrievalService(session).search(
        payload.query,
        district=payload.district,
        document_types=payload.document_types,
        document_ids=payload.document_ids,
        limit=payload.limit,
    )


@router.get("/{document_id}")
def get_document(
    document_id: str,
    session: Session = Depends(get_db_session),
) -> dict[str, object]:
    try:
        document = management_service(session).get(document_id)
    except DocumentServiceError as error:
        raise service_error(error) from error
    return serialize_document(document)


@router.get("/{document_id}/file")
def get_document_file(
    document_id: str,
    session: Session = Depends(get_db_session),
) -> FileResponse:
    try:
        document = management_service(session).get(document_id)
    except DocumentServiceError as error:
        raise service_error(error) from error
    path = get_document_storage().path(document.storage_key)
    if not path.exists():
        raise HTTPException(status_code=404, detail={"message": "Stored file not found."})
    return FileResponse(
        path,
        media_type=document.mime_type,
        filename=document.original_filename,
        content_disposition_type="inline",
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    session: Session = Depends(get_db_session),
) -> Response:
    try:
        management_service(session).delete(document_id)
    except DocumentServiceError as error:
        raise service_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{document_id}/reindex", status_code=status.HTTP_202_ACCEPTED)
def reindex_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_db_session),
) -> dict[str, object]:
    try:
        document = management_service(session).queue_reindex(document_id)
    except DocumentServiceError as error:
        raise service_error(error) from error
    background_tasks.add_task(run_document_ingestion, document_id)
    return document
