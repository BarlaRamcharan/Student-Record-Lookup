"""Student Record Lookup System using iterative Binary Search."""

from pathlib import Path
import re

import pandas as pd
from flask import Flask, jsonify, render_template, request


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "students.xlsx"
DATA_SOURCE_LABEL = "D SEC UPDATED ID DATA.xlsx"

app = Flask(__name__)


def natural_roll_key(roll_number):
    """Return a deterministic natural-order key for a roll-number string."""
    parts = re.split(r"(\d+)", roll_number)
    natural_parts = tuple(
        (0, int(part)) if part.isdigit() else (1, part.casefold())
        for part in parts
    )
    return natural_parts + ((2, roll_number),)


def load_students():
    """Load actual Excel rows and sort them by the ROLL NO column."""
    if not DATA_FILE.is_file():
        raise FileNotFoundError(f"Required Excel data file was not found: {DATA_FILE}")
    if DATA_FILE.stat().st_size == 0:
        raise ValueError(f"Excel data file is empty: {DATA_FILE}")

    try:
        workbook = pd.ExcelFile(DATA_FILE, engine="openpyxl")
        if not workbook.sheet_names:
            raise ValueError("The Excel workbook contains no worksheets.")
        data_sheet = workbook.sheet_names[0]
        headers = pd.read_excel(workbook, sheet_name=data_sheet, nrows=0)
    except Exception as error:
        raise ValueError(f"Could not read Excel workbook {DATA_FILE}: {error}") from error

    normalized_columns = {
        " ".join(str(column).strip().upper().split()): column
        for column in headers.columns
    }
    if "ROLL NO" not in normalized_columns:
        raise ValueError(
            f"The first worksheet must contain a 'ROLL NO' column; found: "
            f"{list(frame.columns)}"
        )

    roll_column = normalized_columns["ROLL NO"]
    frame = pd.read_excel(
        workbook,
        sheet_name=data_sheet,
        dtype={roll_column: "string"},
    )
    if frame.empty:
        raise ValueError(f"The first worksheet in {DATA_FILE.name} has no student records.")

    display_columns = {
        "name": ("NAME", "STUDENT NAME"),
        "branch": ("BRANCH", "DEPARTMENT"),
        "year": ("YEAR", "ACADEMIC YEAR"),
        "email": ("EMAIL", "EMAIL ID"),
    }
    students = []
    seen_roll_numbers = set()

    for row in frame.to_dict(orient="records"):
        raw_roll_number = row[roll_column]
        roll_number = "" if pd.isna(raw_roll_number) else str(raw_roll_number).strip()
        if not roll_number:
            raise ValueError("ROLL NO values must not be blank.")
        if roll_number in seen_roll_numbers:
            raise ValueError(f"ROLL NO values must be unique: {roll_number}")
        seen_roll_numbers.add(roll_number)

        student = {"roll_no": roll_number, "details": []}
        for column, raw_value in row.items():
            if pd.isna(raw_value):
                continue
            value = raw_value.item() if hasattr(raw_value, "item") else raw_value
            if hasattr(value, "isoformat"):
                value = value.isoformat()
            if isinstance(value, float) and value.is_integer():
                value = int(value)

            label = str(column).strip()
            student["details"].append({"label": label, "value": value})
            normalized_label = " ".join(label.upper().split())
            for display_key, aliases in display_columns.items():
                if normalized_label in aliases:
                    student[display_key] = value
                    break
        students.append(student)

    students.sort(key=lambda student: natural_roll_key(student["roll_no"]))
    return students, data_sheet, [str(column) for column in frame.columns]


STUDENTS, DATA_SHEET, DATA_COLUMNS = load_students()
SEARCH_TOTALS = {"searches": 0, "operations": 0}


def parse_roll_number(value):
    """Normalize a submitted roll number to its trimmed string form."""
    if isinstance(value, bool):
        return None
    if not isinstance(value, (str, int, float)):
        return None
    cleaned_value = str(value).strip()
    return cleaned_value or None


def binary_search(roll_number):
    """Search sorted records and report every inspected midpoint."""
    # low is the first candidate index; high is the last candidate index.
    low = 0
    high = len(STUDENTS) - 1
    operations = 0
    steps = []

    while low <= high:
        # mid is the center index of the current search interval.
        mid = (low + high) // 2
        middle_roll = STUDENTS[mid]["roll_no"]
        # Count one operation for each midpoint (key) inspected.
        operations += 1

        # Compare the requested key with the roll number at the midpoint.
        target_key = natural_roll_key(roll_number)
        middle_key = natural_roll_key(middle_roll)
        if roll_number == middle_roll:
            comparison = f"{roll_number} matches {middle_roll}."
            direction = "FOUND"
        elif target_key < middle_key:
            comparison = f"{roll_number} is less than {middle_roll}."
            direction = "LEFT"
        else:
            comparison = f"{roll_number} is greater than {middle_roll}."
            direction = "RIGHT"

        steps.append(
            {
                "step": operations,
                "low": low,
                "mid": mid,
                "high": high,
                "middle_roll_no": middle_roll,
                "comparison": comparison,
                "direction": direction,
            }
        )

        if direction == "FOUND":
            return STUDENTS[mid], operations, steps
        if direction == "LEFT":
            # Search the left half by moving high below the midpoint.
            high = mid - 1
        else:
            # Search the right half by moving low above the midpoint.
            low = mid + 1

    return None, operations, steps


def record_search(roll_number):
    student, operations, steps = binary_search(roll_number)
    SEARCH_TOTALS["searches"] += 1
    SEARCH_TOTALS["operations"] += operations
    return {
        "roll_no": roll_number,
        "found": student is not None,
        "student": student,
        "operations": operations,
        "steps": steps,
        "status": "FOUND" if student is not None else "NOT_FOUND",
    }


def current_stats():
    searches = SEARCH_TOTALS["searches"]
    operations = SEARCH_TOTALS["operations"]
    return {
        "total_students": len(STUDENTS),
        "total_searches": searches,
        "total_operations": operations,
        "average_operations": round(operations / searches, 2) if searches else 0,
        "data_source": DATA_SOURCE_LABEL,
        "data_sheet": DATA_SHEET,
        "data_columns": DATA_COLUMNS,
    }


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/search")
def search_student():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Send a JSON object with a roll_no value."}), 400

    roll_number = parse_roll_number(payload.get("roll_no"))
    if roll_number is None:
        return jsonify({"error": "Enter a non-empty roll number using letters and/or numbers."}), 400

    return jsonify({"result": record_search(roll_number), "stats": current_stats()})


@app.post("/api/search-multiple")
def search_multiple_students():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("roll_numbers"), list):
        return jsonify({"error": "Send a JSON object with a roll_numbers list."}), 400

    submitted_numbers = payload["roll_numbers"]
    if not submitted_numbers:
        return jsonify({"error": "Enter at least one roll number."}), 400

    roll_numbers = [parse_roll_number(value) for value in submitted_numbers]
    if any(number is None for number in roll_numbers):
        return jsonify({"error": "Every roll number must be non-empty and contain letters and/or numbers."}), 400

    results = [record_search(number) for number in roll_numbers]
    total_operations = sum(result["operations"] for result in results)
    return jsonify(
        {
            "results": results,
            "total_searches": len(results),
            "total_operations": total_operations,
            "average_operations": round(total_operations / len(results), 2),
            "stats": current_stats(),
        }
    )


@app.get("/api/stats")
def get_stats():
    return jsonify(current_stats())


if __name__ == "__main__":
    app.run(debug=True)
