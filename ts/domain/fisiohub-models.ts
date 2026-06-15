export type PatientChangeFieldKey = "nome" | "statusFinanceiro" | "horario" | "fisioterapeuta" | "celular" | "convenio" | "procedimentos";

export type PatientChangeHistoryEntry = {
    referenceDateIso: string;
    fieldKey: PatientChangeFieldKey;
    fieldLabel: string;
    previousValue: string;
    nextValue: string;
};

export type PatientRecord = {
    nome: string;
    statusFinanceiro: "Pagante" | "Isento";
    horario: string;
    fisioterapeuta: string;
    celular: string;
    convenio: string;
    procedimentos: string;
    createdAtIso: string;
    updatedAtIso: string;
    changeHistory?: PatientChangeHistoryEntry[];
};

export type ProcessedMeta = {
    processedAtIso: string;
    referenceDateIso: string;
    totalImportedLines: number;
    totalPatients: number;
    totalForReferenceDate: number;
};

export type EvolucoesPendingBatch = {
    processedAtIso: string;
    referenceDateIso: string;
    lines: string[];
};

export type BackupKind = "all" | "patients-only" | "all-without-patients";

export type BackupPayload = {
    schema: "fisiohub-backup-v3";
    kind: BackupKind;
    createdAtIso: string;
    storageEntries?: Record<string, string>;
    stagingData?: string;
    processedData?: string;
    patientsRecords?: PatientRecord[];
    processedMeta?: ProcessedMeta;
};

export const FISIOHUB_RUNTIME_KEYS = {
    PATIENTS_FALLBACK_SUPPRESSED: "fisiohub-patients-fallback-suppressed-v1",
    FINANCE_FALLBACK_SUPPRESSED: "fisiohub-finance-fallback-suppressed-v1"
} as const;

export const FISIOHUB_STORAGE_KEYS = {
    STAGING_DATA: "fisiohub-staging-data-v2",
    PROCESSED_DATA: "fisiohub-processed-data-v2",
    EVOLUCOES_PENDING_HISTORY: "fisiohub-evolucoes-pending-history-v1",
    DONE_EVOLUTIONS: "fisiohub-evolucoes-realizadas-v1",
    REFERENCE_DATE: "fisiohub-reference-date-v1",
    PATIENTS_RECORDS: "fisiohub-patients-records-v2",
    PROCESSED_META: "fisiohub-processed-meta-v2",
    FINANCE_PATIENT_HISTORY_EXCLUDED_PATIENTS: "fisiohub-finance-patient-history-excluded-patients-v1",
    AGENDAMENTOS_PATIENT_DETAILS_EXCLUDED_PATIENTS: "fisiohub-agendamentos-patient-details-excluded-patients-v1"
} as const;