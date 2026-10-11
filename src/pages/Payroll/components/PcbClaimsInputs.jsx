import React from "react";

const inputClass =
  "w-full px-4 py-2 border border-gray-300 rounded-xl text-sm bg-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)] transition-all";

const numberFrom = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const clearZeroOnBackspace = (e, clearFn) => {
  if (
    (e.key === "Backspace" || e.key === "Delete") &&
    Number(e.target.value || 0) === 0
  ) {
    e.preventDefault();
    clearFn();
  }
};

const deductionFields = [
  {
    key: "c1MedicalTreatmentParents",
    label: "C1(a) Medical treatment, special needs & caregivers (Parents)",
  },
  { key: "c1DentalTreatment", label: "C1(b) Dental treatment (Parents)" },
  {
    key: "c1FullMedicalCheckupVaccinationsLimited",
    label: "C1(c) Full medical check-up incl vaccinations (Limited)",
  },

  {
    key: "c2BasicSupportEquipmentDisabilities",
    label: "C2 Basic support equipment for disabilities",
  },

  {
    key: "c3StudyFeesOtherThanMastersOrPhd",
    label: "C3(a) Study fees (Other than Master's/PhD fields)",
  },
  {
    key: "c3StudyFeesMastersOrPhd",
    label: "C3(b) Study fees (Master's/Doctorate)",
  },
  {
    key: "c3SkillsEnhancementOrPersonalDevelopmentCoursesLimited",
    label: "C3(c) Skills enhancement/personal development (Limited)",
  },

  {
    key: "c4SeriousIllnessAffectingOneselfSpouseChild",
    label: "C4(a) Serious illness (Oneself/Spouse/Child)",
  },
  {
    key: "c4FertilityTreatmentForOneselfSpouse",
    label: "C4(b) Fertility treatment (Oneself/Spouse)",
  },
  { key: "c4VaccinationLimited", label: "C4(c) Vaccination (Limited)" },
  {
    key: "c4DentalCheckupAndTreatmentLimited",
    label: "C4(d) Dental checkup & treatment (Limited)",
  },
  {
    key: "c4FullMedicalCheckupLimited",
    label: "C4(e) Full medical check-up / mental health (Limited)",
  },
  {
    key: "c4AssessmentRehabChildrenLearningDisabilitiesLimited",
    label: "C4(f) Children learning disabilities assessment/rehab (Limited)",
  },

  {
    key: "c5BooksJournalsMagazinesNewspapers",
    label: "C5(a) Books/journals/magazines/newspapers",
  },
  {
    key: "c5PersonalComputersSmartphonesTabletsLimited",
    label: "C5(b) Personal computers/smartphones/tablets (Limited)",
  },
  {
    key: "c5InternetSubscriptionMonthly",
    label: "C5(c) Monthly internet subscription (in your name)",
  },
  {
    key: "c5SelfImprovementSkillCourses",
    label: "C5(d) Self-improvement skill courses",
  },

  { key: "c6SportsEquipment", label: "C6(a) Purchase of sports equipment" },
  {
    key: "c6SportsFacilitiesRentalEntryFeesLimited",
    label: "C6(b) Rental/entry fees for sports facilities (Limited)",
  },
  {
    key: "c6SportsCompetitionRegistrationFees",
    label: "C6(c) Sports competition registration fee",
  },
  {
    key: "c6GymMembershipSportsTrainingFees",
    label: "C6(d) Gym membership / sports training fees",
  },

  {
    key: "c7BreastfeedingEquipmentLimited",
    label: "C7 Breastfeeding equipment (Child aged <= 2, Limited)",
  },
  {
    key: "c8ChildcareCentersFees",
    label: "C8 Childcare/kindergarten fees (Child aged <= 6)",
  },

  {
    key: "c9NetSavingsInNES",
    label: "C9 Net savings in National Education Savings Scheme (NES)",
  },
  { key: "c10AlimonyPaymentsExWife", label: "C10 Alimony payments to ex-wife" },

  { key: "c11VoluntaryEPFLimited", label: "C11(a) Voluntary EPF (Limited)" },
  {
    key: "c11LifeInsuranceOrVoluntaryEPFLimited",
    label: "C11(b) Life insurance / Voluntary EPF (Limited)",
  },

  {
    key: "c12PrivateRetirementSchemesDeferredAnnuities",
    label: "C12 Private retirement schemes & deferred annuities",
  },
  {
    key: "c13EducationAndMedicalInsurance",
    label: "C13 Education and medical insurance",
  },
  {
    key: "c14PerkesoEISContributions",
    label: "C14 PERKESO / Employment Insurance System (EIS) contributions",
  },
  {
    key: "c15EVChargingOrCompostingMachineExpensesLimited",
    label: "C15 EV charging / composting machine expenses (Limited)",
  },

  {
    key: "c16HomeLoanInterestUpTo500k",
    label: "C16(a) Home loan interest (House price up to RM500,000)",
  },
  {
    key: "c16HomeLoanInterest500kTo750k",
    label: "C16(b) Home loan interest (RM500,001 to RM750,000)",
  },
  {
    key: "c17DomesticTourismEntryFees",
    label: "C17 Domestic tourism entrance/cultural/arts fees (RM1,000 limit)",
  },
];

const rebateFields = [
  {
    key: "d1ZakatOtherThanMonthlyDeductions",
    label: "D1(a) Zakat (other than monthly salary deductions)",
  },
  {
    key: "d1UmrahExemptionLevy",
    label: "D1(b) Exemption levy for Umrah / religious travel",
  },
];

const PcbClaimsInputs = ({ formData, setFormData }) => {
  const claims = formData?.pcbClaims || {};
  const tp1 = claims.tp1 || {};
  const tp1D = tp1.deductions || {};
  const tp1R = tp1.rebates || {};
  const tp3 = claims.tp3 || {};

  const explicitTotal = numberFrom(tp1.totalDeductionsAnnual);
  const bucketTotal = deductionFields.reduce(
    (s, f) => s + numberFrom(tp1D[f.key]),
    0,
  );
  const usedTotalDeductionsAnnual =
    bucketTotal > 0 ? bucketTotal : explicitTotal;

  const bucketZakat = numberFrom(tp1R.d1ZakatOtherThanMonthlyDeductions);
  const bucketUmrah = numberFrom(tp1R.d1UmrahExemptionLevy);
  const zakatAnnual =
    bucketZakat > 0 ? bucketZakat : numberFrom(tp1.zakatAnnual);
  const umrahAnnual =
    bucketUmrah > 0 ? bucketUmrah : numberFrom(tp1.umrahAnnual);

  const prevMonths = Math.max(
    0,
    Math.min(11, numberFrom(tp3.previousEmploymentMonthsWorked)),
  );
  const prevMonthlyGross = numberFrom(
    tp3.previousEmploymentMonthlyGrossRemuneration,
  );
  const prevMonthlyTaxExempt = numberFrom(
    tp3.previousEmploymentMonthlyTaxExemptAllowances,
  );
  const prevMonthlyTaxable = Math.max(
    0,
    prevMonthlyGross - prevMonthlyTaxExempt,
  );
  const prevApprovedEpfAnnual = numberFrom(
    tp3.previousEmploymentApprovedEpfContributionsAnnual,
  );
  const prevZakatAnnual = numberFrom(tp3.previousEmploymentZakatAnnual);
  const prevUmrahExemptionLevyAnnual = numberFrom(
    tp3.previousEmploymentUmrahExemptionLevyAnnual,
  );

  const updateTp1Deduction = (key, value) => {
    const n = value === "" ? "" : numberFrom(value);
    setFormData((f) => ({
      ...f,
      pcbClaims: {
        ...(f.pcbClaims || {}),
        tp1: {
          ...((f.pcbClaims || {}).tp1 || {}),
          deductions: {
            ...(((f.pcbClaims || {}).tp1 || {}).deductions || {}),
            [key]: n,
          },
        },
      },
    }));
  };

  const blurTp1Deduction = (key) => {
    setFormData((f) => {
      const d = ((f.pcbClaims || {}).tp1 || {}).deductions || {};
      return {
        ...f,
        pcbClaims: {
          ...(f.pcbClaims || {}),
          tp1: {
            ...((f.pcbClaims || {}).tp1 || {}),
            deductions: { ...d, [key]: numberFrom(d[key]) },
          },
        },
      };
    });
  };

  const updateTp1Rebate = (key, value) => {
    const n = value === "" ? "" : numberFrom(value);
    setFormData((f) => ({
      ...f,
      pcbClaims: {
        ...(f.pcbClaims || {}),
        tp1: {
          ...((f.pcbClaims || {}).tp1 || {}),
          rebates: {
            ...(((f.pcbClaims || {}).tp1 || {}).rebates || {}),
            [key]: n,
          },
        },
      },
    }));
  };

  const blurTp1Rebate = (key) => {
    setFormData((f) => {
      const r = ((f.pcbClaims || {}).tp1 || {}).rebates || {};
      return {
        ...f,
        pcbClaims: {
          ...(f.pcbClaims || {}),
          tp1: {
            ...((f.pcbClaims || {}).tp1 || {}),
            rebates: { ...r, [key]: numberFrom(r[key]) },
          },
        },
      };
    });
  };

  const updateTp3 = (key, value) => {
    const n = value === "" ? "" : numberFrom(value);
    setFormData((f) => ({
      ...f,
      pcbClaims: {
        ...(f.pcbClaims || {}),
        tp3: {
          ...((f.pcbClaims || {}).tp3 || {}),
          [key]: n,
        },
      },
    }));
  };

  const blurTp3 = (key) => {
    setFormData((f) => {
      const t3 = (f.pcbClaims || {}).tp3 || {};
      return {
        ...f,
        pcbClaims: {
          ...(f.pcbClaims || {}),
          tp3: { ...t3, [key]: numberFrom(t3[key]) },
        },
      };
    });
  };

  return (
    <div className="mt-4 space-y-6">
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200/80 rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
              TP1 Annual Deductions (for PCB projection)
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Values are annual projection inputs. Monthly PCB will be computed
              cumulatively using prior PCB paid (TP3).
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Used TP1 Deductions Total</p>
            <p className="text-sm font-semibold text-gray-900">
              RM {usedTotalDeductionsAnnual.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
        <h4 className="text-sm font-bold text-gray-700 mb-4 tracking-tight">
          Section C: Deductions (TP1)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {deductionFields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {f.label}
              </label>
              <input
                type="number"
                step="0.01"
                value={tp1D[f.key] ?? 0}
                onKeyDown={(e) =>
                  clearZeroOnBackspace(e, () => updateTp1Deduction(f.key, ""))
                }
                onChange={(e) => updateTp1Deduction(f.key, e.target.value)}
                onBlur={() => blurTp1Deduction(f.key)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-green-400" />
        <h4 className="text-sm font-bold text-gray-700 mb-4 tracking-tight">
          Section D: Rebates (TP1)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rebateFields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {f.label}
              </label>
              <input
                type="number"
                step="0.01"
                value={tp1R[f.key] ?? 0}
                onKeyDown={(e) =>
                  clearZeroOnBackspace(e, () => updateTp1Rebate(f.key, ""))
                }
                onChange={(e) => updateTp1Rebate(f.key, e.target.value)}
                onBlur={() => blurTp1Rebate(f.key)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-600">
          Zakat total used: RM {zakatAnnual.toFixed(2)} · Umrah exemption used:
          RM {umrahAnnual.toFixed(2)}
        </div>
      </div>

      <div className="p-6 rounded-xl border border-gray-200/80 shadow-md font-sans text-[#303030] font-normal mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
        <h4 className="text-sm font-bold text-gray-700 mb-4 tracking-tight">
          TP3 Previous Employment (Cumulative PCB)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Previous employment months already worked before this employer
            </label>
            <input
              type="number"
              min={0}
              max={11}
              step="1"
              value={tp3.previousEmploymentMonthsWorked ?? 0}
              onKeyDown={(e) =>
                clearZeroOnBackspace(e, () =>
                  updateTp3("previousEmploymentMonthsWorked", ""),
                )
              }
              onChange={(e) =>
                updateTp3("previousEmploymentMonthsWorked", e.target.value)
              }
              onBlur={() => blurTp3("previousEmploymentMonthsWorked")}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Previous employment monthly gross remuneration (C1)
            </label>
            <input
              type="number"
              step="0.01"
              value={tp3.previousEmploymentMonthlyGrossRemuneration ?? 0}
              onKeyDown={(e) =>
                clearZeroOnBackspace(e, () =>
                  updateTp3("previousEmploymentMonthlyGrossRemuneration", ""),
                )
              }
              onChange={(e) =>
                updateTp3(
                  "previousEmploymentMonthlyGrossRemuneration",
                  e.target.value,
                )
              }
              onBlur={() =>
                blurTp3("previousEmploymentMonthlyGrossRemuneration")
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Previous employment monthly tax-exempt allowances (C2)
            </label>
            <input
              type="number"
              step="0.01"
              value={tp3.previousEmploymentMonthlyTaxExemptAllowances ?? 0}
              onKeyDown={(e) =>
                clearZeroOnBackspace(e, () =>
                  updateTp3("previousEmploymentMonthlyTaxExemptAllowances", ""),
                )
              }
              onChange={(e) =>
                updateTp3(
                  "previousEmploymentMonthlyTaxExemptAllowances",
                  e.target.value,
                )
              }
              onBlur={() =>
                blurTp3("previousEmploymentMonthlyTaxExemptAllowances")
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              TP3 Previous PCB paid (C5) - accumulated, RM
            </label>
            <input
              type="number"
              step="0.01"
              value={tp3.previousPcbPaid ?? 0}
              onKeyDown={(e) =>
                clearZeroOnBackspace(e, () => updateTp3("previousPcbPaid", ""))
              }
              onChange={(e) => updateTp3("previousPcbPaid", e.target.value)}
              onBlur={() => blurTp3("previousPcbPaid")}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              TP3 Previous Employment EPF Contributions (C3, Total RM)
            </label>
            <input
              type="number"
              step="0.01"
              value={tp3.previousEmploymentApprovedEpfContributionsAnnual ?? 0}
              onKeyDown={(e) =>
                clearZeroOnBackspace(e, () =>
                  updateTp3(
                    "previousEmploymentApprovedEpfContributionsAnnual",
                    "",
                  ),
                )
              }
              onChange={(e) =>
                updateTp3(
                  "previousEmploymentApprovedEpfContributionsAnnual",
                  e.target.value,
                )
              }
              onBlur={() =>
                blurTp3("previousEmploymentApprovedEpfContributionsAnnual")
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              TP3 Previous Employment Zakat (C4, Total RM)
            </label>
            <input
              type="number"
              step="0.01"
              value={tp3.previousEmploymentZakatAnnual ?? 0}
              onKeyDown={(e) =>
                clearZeroOnBackspace(e, () =>
                  updateTp3("previousEmploymentZakatAnnual", ""),
                )
              }
              onChange={(e) =>
                updateTp3("previousEmploymentZakatAnnual", e.target.value)
              }
              onBlur={() => blurTp3("previousEmploymentZakatAnnual")}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              TP3 Previous Employment Umrah Exemption Levy (C4, Total RM)
            </label>
            <input
              type="number"
              step="0.01"
              value={tp3.previousEmploymentUmrahExemptionLevyAnnual ?? 0}
              onKeyDown={(e) =>
                clearZeroOnBackspace(e, () =>
                  updateTp3("previousEmploymentUmrahExemptionLevyAnnual", ""),
                )
              }
              onChange={(e) =>
                updateTp3(
                  "previousEmploymentUmrahExemptionLevyAnnual",
                  e.target.value,
                )
              }
              onBlur={() =>
                blurTp3("previousEmploymentUmrahExemptionLevyAnnual")
              }
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600">
          Derived previous employment taxable monthly (C1 - C2): RM{" "}
          {prevMonthlyTaxable.toFixed(2)}.
        </div>
      </div>
    </div>
  );
};

export default PcbClaimsInputs;
