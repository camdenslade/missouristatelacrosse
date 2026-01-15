// src/Women/Local/Pages/Roster/hooks/printStyles.js
export const rosterPrintStyle = `
  @media print {
    @page { margin: 0; size: auto; }
    html, body {
      background: white !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    nav, header, footer, .footer, .no-print, .print\\:hidden, select, .print-button {
      display: none !important;
      visibility: hidden !important;
    }
    .roster-printable {
      display: block !important;
      margin: 0;
      padding: 0;
    }
    .print-header {
      background-color: #5E0009 !important;
      color: white !important;
      text-align: center;
      padding: 1rem 0;
      font-size: 1.25rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    h1 {
      text-align: center;
      font-size: 1.5rem !important;
      font-weight: 700 !important;
      margin: 1rem 0;
      color: black !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #000;
      padding: 6px 8px;
    }
    th {
      background-color: #5E0009 !important;
      color: white !important;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f7f7f7 !important;
    }
  }
`;

