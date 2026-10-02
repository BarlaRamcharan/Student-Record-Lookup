"use strict";

const searchForm = document.querySelector("#search-form");
const rollInput = document.querySelector("#roll-input");
const clearButton = document.querySelector("#clear-search");
const searchError = document.querySelector("#search-error");
const resultArea = document.querySelector("#student-result");
const stepsBody = document.querySelector("#steps-body");
const stepCount = document.querySelector("#step-count");
const traceOutcome = document.querySelector("#trace-outcome");
const batchForm = document.querySelector("#batch-form");
const batchInput = document.querySelector("#batch-input");
const batchError = document.querySelector("#batch-error");
const batchBody = document.querySelector("#batch-body");
const batchSummary = document.querySelector("#batch-summary");
const chartCanvas = document.querySelector("#performance-chart");
const chartEmpty = document.querySelector("#chart-empty");
const chartHistory = [];
let performanceChart = null;

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "The request could not be completed.");
  }
  return payload;
}

function updateStats(stats) {
  document.querySelector("#total-students").textContent = stats.total_students;
  document.querySelector("#total-searches").textContent = stats.total_searches;
  document.querySelector("#total-operations").textContent = stats.total_operations;
  document.querySelector("#average-operations").textContent = stats.average_operations;
  document.querySelector("#index-count").textContent = `${stats.total_students} records`;
  document.querySelector("#proof-student-count").textContent = stats.total_students;
  const maximumOperations = stats.total_students > 0 ? Math.floor(Math.log2(stats.total_students)) + 1 : 0;
  document.querySelector("#proof-max-operations").textContent = maximumOperations;
}

function addCell(row, value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = value;
  if (className) cell.className = className;
  row.append(cell);
}

function renderStudentResult(result) {
  resultArea.replaceChildren();
  const wrapper = document.createElement("div");
  wrapper.className = "student-result";
  const status = document.createElement("span");
  status.className = `result-status${result.found ? "" : " not-found"}`;
  status.textContent = result.found ? "FOUND" : "Student Not Found";
  wrapper.append(status);

  if (result.student) {
    const details = document.createElement("div");
    const name = document.createElement("p");
    name.className = "student-name";
    name.textContent = result.student.name || "Record found";
    const meta = document.createElement("div");
    meta.className = "student-meta";
    result.student.details.forEach(({ label, value }) => {
      const item = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      item.append(strong, document.createTextNode(String(value)));
      meta.append(item);
    });
    details.append(name, meta);
    wrapper.append(details);
  } else {
    const message = document.createElement("p");
    message.className = "student-name";
    message.textContent = `Student Not Found: ${result.roll_no}`;
    wrapper.append(message);
  }
  resultArea.append(wrapper);
}

function renderSteps(result) {
  stepsBody.replaceChildren();
  stepCount.textContent = `${result.operations} ${result.operations === 1 ? "comparison" : "comparisons"}`;
  traceOutcome.textContent = result.found ? `Roll ${result.roll_no} found` : `Roll ${result.roll_no} not found`;

  if (!result.steps.length) {
    const row = document.createElement("tr");
    row.className = "table-empty";
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No midpoint was inspected.";
    row.append(cell);
    stepsBody.append(row);
    return;
  }

  result.steps.forEach((step) => {
    const row = document.createElement("tr");
    [step.step, step.low, step.mid, step.high, step.middle_roll_no, step.comparison].forEach((value) => addCell(row, value));
    const direction = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `direction${step.direction === "FOUND" ? " found" : ""}`;
    badge.textContent = step.direction;
    direction.append(badge);
    row.append(direction);
    stepsBody.append(row);
  });
}

function updateChart(result) {
  if (typeof Chart === "undefined") {
    document.querySelector("#chart-total").textContent = "Chart.js unavailable";
    return;
  }
  chartHistory.push({ rollNo: result.roll_no, operations: result.operations });
  if (chartHistory.length > 12) chartHistory.shift();
  chartEmpty.classList.add("is-hidden");
  document.querySelector("#chart-total").textContent = `${chartHistory.length} data ${chartHistory.length === 1 ? "point" : "points"}`;

  if (!performanceChart) {
    performanceChart = new Chart(chartCanvas, {
      type: "bar",
      data: {
        labels: chartHistory.map((entry) => String(entry.rollNo)),
        datasets: [{
          label: "Operations",
          data: chartHistory.map((entry) => entry.operations),
          backgroundColor: "#4d83df",
          hoverBackgroundColor: "#2865d7",
          borderRadius: 3,
          maxBarThickness: 27,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 280 },
        plugins: { legend: { display: false }, tooltip: { displayColors: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#8794a1", maxRotation: 0, autoSkip: true, font: { size: 9 } }, border: { display: false } },
          y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0, color: "#8794a1", font: { size: 9 } }, grid: { color: "#edf0f2" }, border: { display: false } },
        },
      },
    });
    return;
  }

  performanceChart.data.labels = chartHistory.map((entry) => String(entry.rollNo));
  performanceChart.data.datasets[0].data = chartHistory.map((entry) => entry.operations);
  performanceChart.update();
}

function showBatchResult(result) {
  const row = document.createElement("tr");
  addCell(row, result.roll_no);
  addCell(row, result.student ? (result.student.name || "Record found") : "—");
  const statusCell = document.createElement("td");
  const status = document.createElement("span");
  status.className = `result-pill${result.found ? "" : " not-found"}`;
  status.textContent = result.found ? "FOUND" : "Student Not Found";
  statusCell.append(status);
  row.append(statusCell);
  addCell(row, result.operations);
  batchBody.append(row);
}

async function loadStats() {
  try {
    updateStats(await requestJson("/api/stats"));
  } catch (error) {
    setMessage(searchError, error.message, true);
  }
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(searchError, "");
  const button = searchForm.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const payload = await requestJson("/api/search", {
      method: "POST",
      body: JSON.stringify({ roll_no: rollInput.value }),
    });
    renderStudentResult(payload.result);
    renderSteps(payload.result);
    updateChart(payload.result);
    updateStats(payload.stats);
  } catch (error) {
    setMessage(searchError, error.message, true);
  } finally {
    button.disabled = false;
  }
});

rollInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchForm.requestSubmit();
});

clearButton.addEventListener("click", () => {
  rollInput.value = "";
  setMessage(searchError, "Enter a roll number from the Excel records.");
  resultArea.innerHTML = '<div class="empty-result"><span class="empty-mark">↳</span><span>Search a roll number to view the student record and comparison trace.</span></div>';
  stepsBody.innerHTML = '<tr class="table-empty"><td colspan="7">The midpoint checks will appear here after a search.</td></tr>';
  stepCount.textContent = "0 comparisons";
  traceOutcome.textContent = "Waiting for a search";
  rollInput.focus();
});

batchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(batchError, "");
  const rollNumbers = batchInput.value.split(/[\s,;]+/).filter(Boolean);
  if (!rollNumbers.length) {
    setMessage(batchError, "Enter one or more roll numbers.", true);
    return;
  }

  const button = batchForm.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const payload = await requestJson("/api/search-multiple", {
      method: "POST",
      body: JSON.stringify({ roll_numbers: rollNumbers }),
    });
    batchBody.replaceChildren();
    payload.results.forEach((result) => {
      showBatchResult(result);
      updateChart(result);
    });
    document.querySelector("#batch-searches").textContent = payload.total_searches;
    document.querySelector("#batch-operations").textContent = payload.total_operations;
    document.querySelector("#batch-average").textContent = payload.average_operations;
    batchSummary.hidden = false;
    updateStats(payload.stats);
  } catch (error) {
    setMessage(batchError, error.message, true);
  } finally {
    button.disabled = false;
  }
});

loadStats();
