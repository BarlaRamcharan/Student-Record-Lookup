# Student Record Lookup System

A beginner-friendly Design and Analysis of Algorithms project that searches actual university student records from `data/students.xlsx` with a manually implemented iterative Binary Search.

## Live Demo

[Open FindMyRoll](https://findmyroll.up.railway.app)

## Problem Statement

A university needs to retrieve a student record by roll number from a large, ordered collection. Checking every record one by one can require up to $n$ comparisons. This project demonstrates how Binary Search uses the sorted order to discard half of the remaining records after each comparison.

## Objective

Search for one or more student roll numbers, display the matching student information, and count the midpoint inspections needed for each lookup. The dashboard collects search totals and plots operation counts so the algorithm's behavior can be examined.

## DAA Concept

Binary Search is a divide-and-conquer search algorithm. It works only when the records are sorted by the key being searched. The implementation keeps an inclusive `low` and `high` index, inspects the `mid` index, and continues in only one half of the current interval.

The operation counter records one operation for each midpoint key inspected. It is a count of key comparisons/probes, not a count of every low-level Python comparison or assignment.

## How Binary Search Works

1. Start with `low = 0` and `high = number of students - 1`.
2. Compute `mid = (low + high) // 2` and compare that record's roll number with the target.
3. If they match, return the student.
4. If the target is smaller, move `high` to `mid - 1` to search the left half.
5. If the target is larger, move `low` to `mid + 1` to search the right half.
6. If `low` becomes greater than `high`, the roll number is not in the records.

Each midpoint inspection, its low/mid/high indexes, comparison, and direction are returned as a trace.

## Features

- Search one roll number without reloading the dashboard.
- Search a comma-, space-, or newline-separated list of roll numbers.
- See student details or a clear not-found result.
- Inspect each Binary Search step and the number of midpoint comparisons.
- Track total students, total searches, total operations, and average operations for the current server process.
- View an updating Chart.js bar chart of recent searches.
- Load and sort records from the first worksheet in `data/students.xlsx` using pandas and openpyxl.
- Show all populated fields from the matched Excel row.
- Report the workbook's actual record count and data source in the dashboard.
- Validate malformed input and show useful error messages.

## Technology Stack

- Python 3.9 or newer
- Flask, pandas, and openpyxl
- HTML, CSS, and vanilla JavaScript
- Chart.js 4 (loaded from jsDelivr in the browser)
- Excel workbook storage; no database required

## Project Structure

```text
student-record-lookup/
├── app.py
├── requirements.txt
├── README.md
├── data/
│   └── students.xlsx
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js
```

## Install Dependencies

From the project directory, create and activate a virtual environment, then install the required packages:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

On macOS or Linux, activate the environment with `source .venv/bin/activate` instead.

## Run the Flask Application

For local development, run:

```powershell
python app.py
```

For Render or another production WSGI server, run `gunicorn app:app`. The root `Procfile` contains this start command for Render.

Open `http://127.0.0.1:5000` in a browser. Before Flask starts, the application reads `data/students.xlsx` with openpyxl, loads the first worksheet with pandas, and requires a non-empty worksheet with a unique, nonblank `ROLL NO` column. Roll numbers are preserved as trimmed strings and sorted with natural ordering. If the workbook is missing, empty, invalid, or has an incompatible schema, startup stops with an error instead of using substitute data.

The application reads the included workbook at startup and reports its actual sheet name and columns through `/api/stats`.

## API Endpoints

### `POST /api/search`

Request:

```json
{"roll_no": "<a value from the ROLL NO column>"}
```

The response includes `result.found`, `result.student`, `result.operations`, `result.steps`, and updated `stats`. Invalid input returns HTTP 400 with an `error` message.

### `POST /api/search-multiple`

Request:

```json
{"roll_numbers": ["<first actual roll number>", "<another actual roll number>"]}
```

The response includes one result per requested number and batch totals and average operations.

### `GET /api/stats`

Returns the number of students plus search, operation, and average-operation totals since the Flask process started. These counters reset when the process restarts.

## Complexity Analysis

| Case | Time | Explanation |
| --- | --- | --- |
| Best | $O(1)$ | The first midpoint is the target. |
| Average | $O(\log n)$ | The interval is halved after each comparison. |
| Worst | $O(\log n)$ | A miss or last match takes at most about $\log_2(n) + 1$ midpoint inspections. |
| Space | $O(1)$ auxiliary | Iterative search uses a fixed number of variables, excluding the returned trace. |

The visible trace itself requires $O(\log n)$ space because it stores each search step. With $n$ workbook records, the iterative search performs at most $\lfloor\log_2 n\rfloor + 1$ midpoint inspections, while a linear scan may inspect all $n$ records.

## Example Search

Search for a value present in the workbook's `ROLL NO` column. The application returns that actual Excel row, the inspected midpoint indexes, and the comparison count. A value absent from the column produces a not-found result and reports the comparisons made before the interval became empty.

## Future Enhancements

- Add support for selecting a worksheet when a workbook contains multiple data sheets.
- Add filtering or export for batch-search results.
- Persist aggregate search metrics across application restarts.
- Add automated unit and API tests for larger datasets and edge cases.
