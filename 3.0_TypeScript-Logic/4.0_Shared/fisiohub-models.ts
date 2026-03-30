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
    schema: "fisiohub-backup-v2";
    kind: BackupKind;
    createdAtIso: string;
    stagingData?: string;
    processedData?: string;
    patientsRecords?: PatientRecord[];
    processedMeta?: ProcessedMeta;
};

export const FISIOHUB_STORAGE_KEYS = {
    LEGACY_IMPORTED_DATA: "fisiohub-imported-data-lines-v1",
    STAGING_DATA: "fisiohub-staging-data-v2",
    PROCESSED_DATA: "fisiohub-processed-data-v2",
    EVOLUCOES_PENDING_HISTORY: "fisiohub-evolucoes-pending-history-v1",
    DONE_EVOLUTIONS: "fisiohub-evolucoes-realizadas-v1",
    REFERENCE_DATE: "fisiohub-reference-date-v1",
    PATIENTS_RECORDS: "fisiohub-patients-records-v2",
    PROCESSED_META: "fisiohub-processed-meta-v2"
} as const;