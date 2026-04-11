from __future__ import annotations

from io import BytesIO

from PIL import Image

from homework_management.models import HomeworkSubmission, SubmissionImage


def export_submission_images_pdf(*, submission: HomeworkSubmission) -> tuple[bytes, str]:
    """
    Merge ordered submission images into a single PDF.
    Returns (bytes, filename).
    """
    images = list(
        SubmissionImage.objects.filter(submission=submission)
        .order_by("page_number", "id")
        .only("image", "page_number")
    )
    if not images:
        raise ValueError("No submission images found.")

    pil_images: list[Image.Image] = []
    try:
        for img in images:
            with Image.open(img.image) as im:
                if im.mode not in ("RGB", "L"):
                    im = im.convert("RGB")
                elif im.mode == "L":
                    im = im.convert("RGB")
                pil_images.append(im.copy())
    except Exception as e:
        for im in pil_images:
            try:
                im.close()
            except Exception:
                pass
        raise ValueError(f"Unable to read submission images: {e}") from e

    first = pil_images[0]
    rest = pil_images[1:]
    buff = BytesIO()
    first.save(buff, format="PDF", save_all=True, append_images=rest)
    for im in pil_images:
        try:
            im.close()
        except Exception:
            pass

    buff.seek(0)
    filename = f"submission_{submission.id}_pages.pdf"
    return buff.getvalue(), filename

