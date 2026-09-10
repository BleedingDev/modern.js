const fs = require('fs');
const path = require('path');
const { shouldRequireCiBackedMetadata } = require('./env');
const { validateMetadataFields } = require('./metadata');

const validateEvidence = ({
  evidenceDir,
  requiredFiles,
  requiredMetadataFields,
  allowMissingEvidence,
  allowLocalEvidenceMetadata = false,
  requireCiBackedMetadata,
}) => {
  const resolvedEvidenceDir = path.resolve(evidenceDir);
  const enforceCiBackedMetadata = shouldRequireCiBackedMetadata({
    allowMissingEvidence,
    allowLocalEvidenceMetadata,
    requireCiBackedMetadata,
  });
  const report = {
    evidenceDir: resolvedEvidenceDir,
    validatedFiles: [],
    skippedFiles: [],
  };

  for (const requiredFile of requiredFiles) {
    const filePath = path.resolve(resolvedEvidenceDir, requiredFile);
    if (!fs.existsSync(filePath)) {
      if (allowMissingEvidence) {
        report.skippedFiles.push(requiredFile);
        continue;
      }
      throw new Error(
        `Missing required evidence file "${requiredFile}" in ${resolvedEvidenceDir}`,
      );
    }

    const content = fs.readFileSync(filePath, 'utf8');
    validateMetadataFields({
      filePath,
      content,
      requiredMetadataFields,
      requireCiBackedMetadata: enforceCiBackedMetadata,
    });

    report.validatedFiles.push(requiredFile);
  }

  return report;
};

module.exports = {
  validateEvidence,
};
