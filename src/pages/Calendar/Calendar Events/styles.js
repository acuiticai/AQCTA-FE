// Calendar styles
export const calendarStyles = `
  .rbc-calendar {
    font-family: inherit;
    height: auto !important;
    min-height: 600px;
    overflow: visible;
  }

  .rbc-calendar .rbc-month-view,
  .rbc-calendar .rbc-time-view,
  .rbc-calendar .rbc-agenda-view {
  }

  .rbc-header {
    background-color: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    font-weight: 600;
    color: #374151;
    padding: 12px 8px;
  }

  .rbc-agenda-content {
    overflow-y: auto;
  }

  .rbc-agenda-table {
    tr {
      width: 100% !important;
      margin: 2px 0px !important;
    }
  }

  .rbc-today {
    background-color: #eff6ff;
  }

  .rbc-event {
    border-radius: 6px;
    padding: 4px 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    height: 70px !important;
    max-height: 70px !important;
    margin-bottom: 5px !important;
    overflow: hidden;
  }
  .rbc-row:not(.rbc-addons-dnd-row-body .rbc-row) {
    height: 35px !important;
  }

  /* Ensure only one event is shown per cell */
  .rbc-month-row .rbc-event {
    margin-bottom: 2px;
  }

  /* Hide additional events beyond the first one */
  .rbc-month-row .rbc-event:nth-child(n+2) {
    display: none !important;
  }

  /* Ensure proper text wrapping for event titles */
  .rbc-event .rbc-event-content {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .rbc-overlay {
    max-height: 90%;
    overflow: auto;
    position: fixed;
    top: 50% !important;
    transform: translate(100%, -50%) !important;
    left: 100px !important;
    width: 200px !important;
    max-width: 200px !important;
    min-width: 200px !important;
    z-index: 1000;
    background-color: white;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 5px;
  }

  .rbc-event:hover {
    opacity: 1 !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
  }

  .rbc-event.rbc-selected {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .rbc-slot-selection {
    background-color: rgba(59, 130, 246, 0.1);
    border: 2px dashed rgba(59, 130, 246, 0.5);
  }

  .rbc-time-slot {
    border-top: 1px solid #f1f5f9;
  }

  .rbc-time-content {
    border-top: 1px solid #e2e8f0;
  }

  .rbc-current-time-indicator {
    background-color: #dc2626;
    height: 2px;
    z-index: 10;
  }

  .rbc-month-row {
    overflow: visible;
  }

  .rbc-row-content {
    height: 100% !important;

  }

  .rbc-toolbar {
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 0 10px;
  }

  .rbc-toolbar button {
    background-color: #f8fafc;
    border: 1px solid #d1d5db;
    color: #374151;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 500;
    transition: all 0.2s;
    font-size: 14px;
  }

  .rbc-toolbar button:hover {
    background-color: #e2e8f0;
    border-color: #9ca3af;
    transform: translateY(-1px);
  }

  .rbc-toolbar button.rbc-active {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
  }

  .rbc-toolbar button.rbc-btn-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: #f3f4f6;
    border-color: #d1d5db;
    color: #9ca3af;
  }

  .rbc-toolbar button.rbc-btn-disabled:hover {
    background-color: #f3f4f6;
    border-color: #d1d5db;
    color: #9ca3af;
    transform: none;
  }

  .rbc-toolbar-label {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    text-align: center;
    flex: 1;
    margin: 0 30px;
  }

  

  .rbc-month-view {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }

  .rbc-date-cell {
    padding: 8px;
    text-align: right;
    font-weight: 500;
    min-height: 80px;
  }

  .rbc-button-link.rbc-show-more {
    display: flex;
    align-items: center;
    justify-content: start;
    padding: 5px;
    margin: 0;
    width: 100%;
    background-color: transparent;
    border: none;
  }

  /* Ensure month view cells have enough height for events */
  .rbc-month-row .rbc-day-bg {
    min-height: 80px;
  }

  .rbc-month-row .rbc-day {
    min-height: 80px;
  }

  .rbc-date-cell.rbc-off-range-bg {
    background-color: #f9fafb;
    color: #9ca3af;
  }

  .rbc-date-cell.rbc-now {
    color: #1e40af;
    font-weight: 700;
  }

  .rbc-time-view {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .rbc-time-header {
    border-bottom: 2px solid #e5e7eb;
  }

  .rbc-allday-cell {
    background-color: #f8fafc;
  }

  .rbc-agenda-view {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .rbc-agenda-table {
    font-size: 14px;
  }

  .rbc-agenda-table tbody tr:hover {
    background-color: #f8fafc;
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .rbc-calendar {
      min-height: 400px !important;
      overflow: visible;
    }

    .rbc-calendar .rbc-month-view,
    .rbc-calendar .rbc-time-view,
    .rbc-calendar .rbc-agenda-view {
      min-height: 400px !important;
      overflow: visible;
    }

    .rbc-toolbar {
      flex-direction: column;
      gap: 15px;
      padding: 15px;
    }

    .rbc-toolbar-label {
      font-size: 1.25rem;
      order: -1;
    }

    .rbc-btn-group {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .rbc-toolbar button {
      padding: 6px 12px;
      font-size: 12px;
    }

    .rbc-event {
      font-size: 11px;
      padding: 2px 4px;
      height: 50px !important;
      max-height: 50px !important;
    }

    .rbc-header {
      padding: 8px 4px;
      font-size: 12px;
    }
  }
`;
