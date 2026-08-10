const UPSC_FILES = "https://www.upsc.gov.in/sites/default/files";

export const UPSC_PAPER_SOURCE = "https://www.upsc.gov.in/examinations/previous-question-papers";
export const UPSC_PAPER_ARCHIVE = "https://www.upsc.gov.in/examinations/previous-question-papers/archives";

export const OFFICIAL_UPSC_PAPERS = [
  { year: 2026, stage: "Prelims", paper: "General Studies Paper I", url: `${UPSC_FILES}/QP_CSP_2026_GENERAL_STUDIES_PAPER-I_25052026.pdf` },
  { year: 2026, stage: "Prelims", paper: "General Studies Paper II (CSAT)", url: `${UPSC_FILES}/QP_CSP_2026_GENERAL_STUDIES_PAPER-II_25052026.pdf` },
  { year: 2025, stage: "Prelims", paper: "General Studies Paper I", url: `${UPSC_FILES}/QP-CSP-25-GENERAL-STUDIES-PAPER-I-260525.pdf` },
  { year: 2025, stage: "Prelims", paper: "General Studies Paper II (CSAT)", url: `${UPSC_FILES}/QP-CSP-25-GENERAL-STUDIES-PAPER-II-260525.pdf` },
  { year: 2025, stage: "Mains", paper: "Essay", url: `${UPSC_FILES}/ESSAY-QP-CSM-25-010925.pdf` },
  { year: 2025, stage: "Mains", paper: "General Studies Paper I", url: `${UPSC_FILES}/GENERAL-STUDIES-PAPER%20I-QP-CSM-25-010925.pdf` },
  { year: 2025, stage: "Mains", paper: "General Studies Paper II", url: `${UPSC_FILES}/GENERAL-STUDIES-PAPER-II-QP-CSM-25-010925.pdf` },
  { year: 2025, stage: "Mains", paper: "General Studies Paper III", url: `${UPSC_FILES}/GENERAL-STUDIES-PAPER-III-QP-CSM-25-010925.pdf` },
  { year: 2025, stage: "Mains", paper: "General Studies Paper IV", url: `${UPSC_FILES}/GENERAL-STUDIES-PAPER-IV-QP-CSM-25-010925.pdf` },
  { year: 2024, stage: "Prelims", paper: "General Studies Paper I", url: `${UPSC_FILES}/QP-CSP-24-GENERAL-STUDIES-PAPER-I-180624.pdf` },
  { year: 2024, stage: "Prelims", paper: "General Studies Paper II (CSAT)", url: `${UPSC_FILES}/QP-CSP-24-GENERAL-STUDIES-PAPER-II-180624.pdf` },
  { year: 2024, stage: "Mains", paper: "General Studies Paper I", url: `${UPSC_FILES}/QP_CSM_2024_GenStud_I_03102024.pdf` },
  { year: 2024, stage: "Mains", paper: "General Studies Paper II", url: `${UPSC_FILES}/QP_CSM_2024_GenStud_II_03102024.pdf` },
  { year: 2024, stage: "Mains", paper: "General Studies Paper III", url: `${UPSC_FILES}/QP_CSM_2024_GenStud_III_03102024.pdf` },
  { year: 2024, stage: "Mains", paper: "General Studies Paper IV", url: `${UPSC_FILES}/QP_CSM_2024_GenStud_IV_03102024.pdf` },
  { year: 2024, stage: "Mains", paper: "Essay", url: `${UPSC_FILES}/QP_CSM_2024_ESSAY_03102024.pdf` },
  { year: 2023, stage: "Mains", paper: "General Studies Paper I", url: `${UPSC_FILES}/QP-CSM-23-GENERAL-STUDIES-PAPER-I-180923.pdf` },
  { year: 2023, stage: "Mains", paper: "General Studies Paper II", url: `${UPSC_FILES}/QP-CSM-23-GENERAL-STUDIES-PAPER-II-180923.pdf` },
  { year: 2023, stage: "Mains", paper: "General Studies Paper III", url: `${UPSC_FILES}/QP-CSM-23-GENERAL-STUDIES-PAPER-III-180923.pdf` },
  { year: 2023, stage: "Mains", paper: "General Studies Paper IV", url: `${UPSC_FILES}/QP-CSM-23-GENERAL-STUDIES-PAPER-IV-180923.pdf` },


  // 2015-2023 are deliberately linked through the official UPSC archive rather
  // than guessing legacy PDF filenames. The archive contains the original
  // Civil Services Prelims and Mains papers for each of these years.
  { year: 2023, stage: "Prelims", paper: "General Studies & CSAT — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2023, stage: "Mains", paper: "Essay & General Studies — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2022, stage: "Prelims", paper: "General Studies & CSAT — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2022, stage: "Mains", paper: "Essay & General Studies — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2021, stage: "Prelims", paper: "General Studies & CSAT — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2021, stage: "Mains", paper: "Essay & General Studies — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2020, stage: "Prelims", paper: "General Studies & CSAT — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2020, stage: "Mains", paper: "Essay & General Studies — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2019, stage: "Prelims", paper: "General Studies & CSAT — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2019, stage: "Mains", paper: "Essay & General Studies — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2018, stage: "Prelims", paper: "General Studies & CSAT — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2018, stage: "Mains", paper: "Essay & General Studies — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2017, stage: "Prelims", paper: "General Studies & CSAT — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2017, stage: "Mains", paper: "Essay & General Studies — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2016, stage: "Prelims", paper: "General Studies & CSAT — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2016, stage: "Mains", paper: "Essay & General Studies — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2015, stage: "Prelims", paper: "General Studies & CSAT — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2015, stage: "Mains", paper: "Essay & General Studies — official year archive", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2014, stage: "Mains", paper: "Essay, General Studies & optional papers — official archive search", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2013, stage: "Mains", paper: "Essay, General Studies & optional papers — official archive search", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2012, stage: "Mains", paper: "Essay, General Studies & optional papers — official archive search", url: UPSC_PAPER_ARCHIVE, direct: false },
  { year: 2011, stage: "Mains", paper: "Essay, General Studies & optional papers — official archive search", url: UPSC_PAPER_ARCHIVE, direct: false },
];
