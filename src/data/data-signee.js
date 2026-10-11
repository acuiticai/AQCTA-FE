import { StyleSheet } from "@react-pdf/renderer";
export const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    borderBottom: 1,
    borderBottomColor: "#eee",
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: "contain",
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  table: {
    marginVertical: 15,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: "#f9fafb",
    fontWeight: "bold",
  },
  tableCell: {
    fontSize: 10,
    padding: 5,
  },
  section: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#374151",
  },
  content: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  signaturesSection: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  signatureBlock: {
    width: "45%",
    marginVertical: 10,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#9CA3AF",
    marginVertical: 10,
  },
  signatureText: {
    fontSize: 8,
    color: "#6B7280",
    textAlign: "center",
  },
});
