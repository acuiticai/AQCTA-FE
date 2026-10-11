// Source reference used for initial seed:
// https://www.pbebank.com/en/swift/
// (cross-checked with public SWIFT directories)
export const MALAYSIA_BANKS = [
  { name: "Affin Bank Berhad", swiftCode: "PHBMMYKL" },
  { name: "Affin Islamic Bank Berhad", swiftCode: "AIBBMYKL" },
  { name: "Agrobank Berhad", swiftCode: "AGOBMYK1" },
  { name: "Alliance Bank Malaysia Berhad", swiftCode: "MFBBMYKL" },
  { name: "Alliance Islamic Bank Malaysia Berhad", swiftCode: "ALSRMYK1" },
  { name: "Al-Rajhi Bank (Malaysia) Berhad", swiftCode: "RJHIMYKL" },
  { name: "AmBank (M) Berhad", swiftCode: "ARBKMYKL" },
  { name: "AmIslamic Bank (M) Berhad", swiftCode: "AISLMYKL" },
  { name: "Bangkok Bank Berhad", swiftCode: "BKKBMYKL" },
  { name: "Bank Islam Malaysia Berhad", swiftCode: "BIMBMYKL" },
  { name: "Bank Kerjasama Rakyat Malaysia Berhad", swiftCode: "BKRMMYKL" },
  { name: "Bank Muamalat (Malaysia) Berhad", swiftCode: "BMMBMYKL" },
  { name: "Bank of America (Malaysia) Berhad", swiftCode: "BOFAMY2X" },
  { name: "Bank of China (Malaysia) Berhad", swiftCode: "BKCHMYKL" },
  { name: "Bank Simpanan Nasional Berhad", swiftCode: "BSNAMYK1" },
  { name: "BNP Paribas Malaysia Berhad", swiftCode: "BNPAMYKL" },
  { name: "China Construction Bank Berhad", swiftCode: "PCBCMYKL" },
  { name: "CIMB Bank Berhad", swiftCode: "CIBBMYKL" },
  { name: "CIMB Islamic Bank Berhad", swiftCode: "CTBBMYKL" },
  { name: "Citibank Berhad", swiftCode: "CITIMYKL" },
  { name: "Deutsche Bank (M) Berhad", swiftCode: "DEUTMYKL" },
  { name: "Hong Leong Bank Berhad", swiftCode: "HLBBMYKL" },
  { name: "Hong Leong Islamic Bank Berhad", swiftCode: "HLIBMYKL" },
  { name: "HSBC Bank Malaysia Berhad", swiftCode: "HBMBMYKL" },
  { name: "HSBC Amanah Malaysia Berhad", swiftCode: "HMABMYKL" },
  {
    name: "Industrial and Commercial Bank of China (Malaysia) Berhad",
    swiftCode: "ICBKMYKL",
  },
  { name: "JP Morgan Chase Bank Berhad", swiftCode: "CHASMYKL" },
  { name: "Kuwait Finance House (Malaysia) Berhad", swiftCode: "KFHOMYKL" },
  { name: "Malayan Banking Berhad", swiftCode: "MBBEMYKL" },
  { name: "Maybank Islamic Berhad", swiftCode: "MBISMYKL" },
  { name: "MBSB Bank Berhad", swiftCode: "AFBQMYKL" },
  { name: "Mizuho Corporate Bank (Malaysia) Berhad", swiftCode: "MHCBMYKA" },
  { name: "MUFG Bank (Malaysia) Berhad", swiftCode: "BOTKMYKX" },
  { name: "OCBC Bank (Malaysia) Berhad", swiftCode: "OABBMYKL" },
  { name: "OCBC Al-Amin Bank Berhad", swiftCode: "OABBMYKL" },
  { name: "Public Bank Berhad", swiftCode: "PBBEMYKL" },
  { name: "RHB Bank Berhad", swiftCode: "RHBBMYKL" },
  { name: "RHB Islamic Bank Berhad", swiftCode: "RHBAMYKL" },
  { name: "Standard Chartered Bank (Malaysia) Berhad", swiftCode: "SCBLMYKX" },
  { name: "Standard Chartered Saadiq (Malaysia) Berhad", swiftCode: "SCSRMYK1" },
  { name: "Sumitomo Mitsui Banking Corporation Malaysia Berhad", swiftCode: "SMBCMYKL" },
  { name: "United Overseas Bank (Malaysia) Berhad", swiftCode: "UOVBMYKL" },
];

export const MALAYSIA_BANK_OPTIONS = MALAYSIA_BANKS.map((bank) => ({
  value: bank.name,
  label: bank.name,
  name: bank.name,
  swiftCode: bank.swiftCode,
}));

export const findMalaysiaBankByName = (name = "") =>
  MALAYSIA_BANKS.find((bank) => bank.name === name) || null;
