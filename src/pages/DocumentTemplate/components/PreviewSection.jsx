import React from "react";
import {
  PDFViewer,
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import draftToHtml from "draftjs-to-html";
import { convertToRaw } from "draft-js";

const PreviewSection = ({
  documentType,
  logo,
  tableFields,
  tableValues,
  termsEditorState,
  paymentEditorState,
  signees,
}) => {
  const styles = StyleSheet.create({
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

  const formatCellValue = (type, value) => {
    switch (type) {
      case "currency":
        return `$${parseFloat(value || 0).toFixed(2)}`;
      case "percentage":
        return `${value}%`;
      case "date":
        return new Date(value).toLocaleDateString();
      default:
        return value || "";
    }
  };

  const renderSignatureBlocks = () => (
    <View style={styles.signaturesSection}>
      {signees.map((signee, index) => (
        <View key={index} style={styles.signatureBlock}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureText}>{signee.title}</Text>
          {signee.name && (
            <Text style={[styles.signatureText, { fontWeight: "bold" }]}>
              {signee.name}
            </Text>
          )}
          {signee.designation && (
            <Text style={styles.signatureText}>{signee.designation}</Text>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <PDFViewer className="w-full h-screen">
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={{ display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {logo && <Image src={logo.preview} style={styles.logo} />}
                <Text style={styles.documentTitle}>{documentType}</Text>
              </View>
            </View>

            {/* Table Section */}
            <View style={styles.table}>
              <View style={styles.tableRow}>
                {tableFields.map((field) => (
                  <View
                    key={field.id}
                    style={[styles.tableCell, { width: `${field.width}%` }]}
                  >
                    <Text style={styles.tableHeader}>{field.name}</Text>
                  </View>
                ))}
              </View>

              {tableValues.map((row) => (
                <View key={row.id} style={styles.tableRow}>
                  {tableFields.map((field) => (
                    <View
                      key={field.id}
                      style={[styles.tableCell, { width: `${field.width}%` }]}
                    >
                      <Text>
                        {formatCellValue(field.type, row.values[field.id])}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {/* Content Sections */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Terms and Conditions</Text>
              <Text style={styles.content}>
                {draftToHtml(
                  convertToRaw(termsEditorState.getCurrentContent())
                )}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Instructions</Text>
              <Text style={styles.content}>
                {draftToHtml(
                  convertToRaw(paymentEditorState.getCurrentContent())
                )}
              </Text>
            </View>

            {/* Signature Section */}
            {renderSignatureBlocks()}
          </View>
        </Page>
      </Document>
    </PDFViewer>
  );
};

export default PreviewSection;
