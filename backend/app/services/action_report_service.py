"""PDF action report generation for Scenario Lab."""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from textwrap import wrap
from typing import Any


DISCLAIMER = "Decision support only. This report is not an official emergency warning or evacuation order."


class ActionReportService:
    def build_pdf(
        self,
        *,
        scenario: dict[str, Any],
        monitoring: dict[str, Any],
        feedback: dict[str, Any],
        drift: dict[str, Any],
        citations: list[dict[str, Any]] | None = None,
    ) -> bytes:
        try:
            return _build_reportlab_pdf(
                scenario=scenario,
                monitoring=monitoring,
                feedback=feedback,
                drift=drift,
                citations=citations or [],
            )
        except ImportError:
            return _build_basic_pdf(
                _report_lines(
                    scenario=scenario,
                    monitoring=monitoring,
                    feedback=feedback,
                    drift=drift,
                    citations=citations or [],
                )
            )


def _report_lines(
    *,
    scenario: dict[str, Any],
    monitoring: dict[str, Any],
    feedback: dict[str, Any],
    drift: dict[str, Any],
    citations: list[dict[str, Any]],
) -> list[str]:
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    lines = [
        "FloodLens Scenario Action Report",
        f"Generated: {generated_at}",
        f"Location: {scenario.get('place_name')} / {scenario.get('district')}",
        f"Record: {scenario.get('record_id')}",
        f"Coordinates: {scenario.get('latitude')}, {scenario.get('longitude')}",
        f"Model version: {scenario.get('model_version')}",
        "",
        "Risk Summary",
        f"Baseline risk: {scenario.get('baseline_risk_score')} ({scenario.get('baseline_risk_level')})",
        f"Scenario risk: {scenario.get('scenario_risk_score')} ({scenario.get('scenario_risk_level')})",
        f"Score delta: {scenario.get('score_delta')}",
        f"Risk level delta: {scenario.get('risk_level_delta')}",
        f"Operational priority: {scenario.get('operational_priority')}",
        "",
        "Drivers And Assumptions",
        f"Top drivers: {', '.join(scenario.get('risk_drivers') or []) or '-'}",
        f"Changed fields: {', '.join(scenario.get('changed_fields') or []) or '-'}",
        f"Recommended action: {scenario.get('recommended_action')}",
        "",
        "Model Operations Snapshot",
        f"Total predictions: {monitoring.get('total_predictions')}",
        f"Latest prediction: {monitoring.get('latest_prediction_at')}",
        f"Feedback events: {feedback.get('total_feedback')}",
        f"Feedback disagreement rate: {feedback.get('disagreement_rate')}",
        f"Drift status: {drift.get('status')}",
        f"Drift recommendation: {drift.get('recommendation')}",
    ]
    if citations:
        lines.extend(["", "Document Evidence"])
        for citation in citations[:5]:
            title = citation.get("title") or citation.get("document_title") or "Document"
            page = citation.get("page") or citation.get("page_number") or "-"
            lines.append(f"- {title}, page {page}: {citation.get('snippet') or citation.get('text') or ''}")
    lines.extend(["", DISCLAIMER])
    return lines


def _build_reportlab_pdf(
    *,
    scenario: dict[str, Any],
    monitoring: dict[str, Any],
    feedback: dict[str, Any],
    drift: dict[str, Any],
    citations: list[dict[str, Any]],
) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=48, rightMargin=48, topMargin=44, bottomMargin=44)
    styles = getSampleStyleSheet()
    story = []
    for line in _report_lines(scenario=scenario, monitoring=monitoring, feedback=feedback, drift=drift, citations=citations):
        if not line:
            story.append(Spacer(1, 10))
        elif line in {"FloodLens Scenario Action Report", "Risk Summary", "Drivers And Assumptions", "Model Operations Snapshot", "Document Evidence"}:
            story.append(Paragraph(_escape_xml(line), styles["Heading2"]))
        else:
            story.append(Paragraph(_escape_xml(line), styles["BodyText"]))
    doc.build(story)
    return buffer.getvalue()


def _build_basic_pdf(lines: list[str]) -> bytes:
    wrapped_lines: list[str] = []
    for line in lines:
        if not line:
            wrapped_lines.append("")
            continue
        wrapped_lines.extend(wrap(str(line), width=88) or [""])

    pages = [wrapped_lines[index : index + 45] for index in range(0, len(wrapped_lines), 45)]
    objects: list[bytes] = []
    content_object_ids: list[int] = []
    page_object_ids: list[int] = []

    def add_object(payload: bytes) -> int:
        objects.append(payload)
        return len(objects)

    catalog_id = add_object(b"<< /Type /Catalog /Pages 2 0 R >>")
    pages_id = add_object(b"")
    font_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    assert catalog_id == 1 and pages_id == 2 and font_id == 3

    for page_lines in pages:
        commands = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL"]
        for line in page_lines:
            commands.append(f"({_escape_pdf(line)}) Tj")
            commands.append("T*")
        commands.append("ET")
        stream = "\n".join(commands).encode("latin-1", errors="replace")
        content_id = add_object(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
        page_id = add_object(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>".encode()
        )
        content_object_ids.append(content_id)
        page_object_ids.append(page_id)

    objects[pages_id - 1] = f"<< /Type /Pages /Kids [{' '.join(f'{page_id} 0 R' for page_id in page_object_ids)}] /Count {len(page_object_ids)} >>".encode()

    output = BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = [0]
    for index, payload in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(f"{index} 0 obj\n".encode())
        output.write(payload)
        output.write(b"\nendobj\n")
    xref = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n".encode())
    output.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode())
    output.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return output.getvalue()


def _escape_pdf(value: Any) -> str:
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _escape_xml(value: Any) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
