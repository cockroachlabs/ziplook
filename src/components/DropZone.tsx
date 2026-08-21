import React, { useState, useCallback, useRef, useEffect } from "react";
import { useApp } from "../state/AppContext";
import {
  createSendSafelyClient,
  parseSendSafelyUrl,
  type PackageInfo,
  type PackageFile,
} from "../utils/sendSafelyClient";
import type { ZipEntryMeta } from "../state/types";

// Import types that match WorkerManager expectations
interface TableData {
  name: string;
  path: string;
  size: number;
  nodeId?: number;
  originalName?: string;
  isError?: boolean;
  loaded?: boolean;
  loading?: boolean;
  sourceFile?: string;
  clusterName?: string;
  nodeFiles?: Array<{
    path: string;
    size: number;
    nodeId: number;
    isError: boolean;
  }>;
}

interface FileStatus {
  path: string;
  status: "pending" | "indexing" | "completed" | "error";
  progress?: number;
  error?: string;
}

interface ParsedSendSafelyUrl {
  packageCode: string;
  keyCode: string;
  baseUrl: string;
}

interface ValidationStatus {
  isValid: boolean;
  message: string;
  email?: string;
}

interface SendSafelyModalProps {
  hasValidCredentials: () => boolean;
  sendSafelyModalUrl: string;
  setSendSafelyModalUrl: (url: string) => void;
  attemptPackageLoad: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  apiSecret: string;
  setApiSecret: (secret: string) => void;
  isValidating: boolean;
  validationStatus: ValidationStatus | null;
  setValidationStatus: (status: ValidationStatus | null) => void;
  packageLoading: boolean;
  packageError: string | null;
  packageInfo: PackageInfo | null;
  setPackageInfo: (info: PackageInfo | null) => void;
  setPackageError: (error: string | null) => void;
  setPackageLoading: (loading: boolean) => void;
  parsedUrl: ParsedSendSafelyUrl | null;
  validateCredentials: (host: string, key: string, secret: string) => void;
  saveCredentials: (key: string, secret: string) => void;
  loadSendSafelyFile: (file: PackageFile, force?: boolean) => void;
  setLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;
  fileLoading: boolean;
  setFileLoading: (loading: boolean) => void;
}

function SendSafelyModalContent({
  hasValidCredentials,
  sendSafelyModalUrl,
  setSendSafelyModalUrl,
  attemptPackageLoad,
  apiKey,
  setApiKey,
  apiSecret,
  setApiSecret,
  isValidating,
  validationStatus,
  setValidationStatus,
  packageLoading,
  packageError,
  packageInfo,
  setPackageInfo,
  setPackageError,
  setPackageLoading,
  parsedUrl,
  validateCredentials,
  saveCredentials,
  loadSendSafelyFile,
  setLoading,
  loadingMessage,
  setLoadingMessage,
  fileLoading,
  setFileLoading,
}: SendSafelyModalProps) {
  const [showOtherFiles, setShowOtherFiles] = useState(false);
  const [forceStep1, setForceStep1] = useState(false);
  const [showValidateButton, setShowValidateButton] = useState(true);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // On input change: reset button states and optionally auto-validate
  React.useEffect(() => {
    // Reset validation state when fields change
    setShowSaveButton(false);
    setValidationStatus(null);
    setShowValidateButton(true);

    // Auto-validate if fields look good
    const HARDCODED_HOST = "https://cockroachlabs.sendsafely.com";
    const fieldsLookGood = apiKey.length === 22 && apiSecret.length === 22;

    if (fieldsLookGood && !isValidating) {
      const timeoutId = setTimeout(() => {
        validateCredentials(HARDCODED_HOST, apiKey, apiSecret);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [
    apiKey,
    apiSecret,
  ]);

  // Watch for validation status changes to update button states
  React.useEffect(() => {
    if (validationStatus?.isValid) {
      // Hide validate button, show save & continue button
      setShowValidateButton(false);
      setShowSaveButton(true);
    } else if (validationStatus && !validationStatus.isValid) {
      // Re-enable validate button on failure
      setShowValidateButton(true);
      setShowSaveButton(false);
    }
  }, [validationStatus]);

  // Force a re-render when credentials are saved to ensure hasValidCredentials() reflects the change
  React.useEffect(() => {
    if (credentialsSaved) {
      setCredentialsSaved(false); // Reset the flag
    }
  }, [credentialsSaved]);

  // Wizard flow steps:
  // 1. API Keys setup
  // 2. URL entry/validation
  // 3. Package loaded - pick a file
  // 4. File loading/error state

  const step1_needsCredentials = !hasValidCredentials() || forceStep1;
  const step2_needsUrl =
    hasValidCredentials() && !forceStep1 && (!packageInfo || packageError); // Show URL step if no package loaded or error
  const step3_packageReady =
    hasValidCredentials() &&
    !forceStep1 &&
    packageInfo &&
    !packageLoading &&
    !packageError &&
    !fileLoading &&
    !fileError;
  const step4_fileLoading = fileLoading || fileError;

  return (
    <div
      style={{
        padding: "16px",
        overflow: "auto",
        maxHeight: "calc(80vh - 60px)",
      }}
    >
      {/* Step 1: API Credentials Setup */}
      {step1_needsCredentials && (
        <div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              marginBottom: "16px",
            }}
          >
            <p style={{ margin: "0 0 8px 0" }}>
              To access SendSafely packages, you need API credentials:
            </p>
            <ul style={{ margin: "0", paddingLeft: "16px" }}>
              <li>
                Login to{" "}
                <a
                  href="https://upload.cockroachlabs.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--accent-primary)",
                    textDecoration: "underline",
                  }}
                >
                  https://upload.cockroachlabs.com
                </a>
              </li>
              <li>
                Click your user in top right corner and select 'Edit Profile'
              </li>
              <li>Go to 'API Keys' to generate a new key</li>
              <li>Provide the Key ID and Secret below</li>
            </ul>
            <p
              style={{
                margin: "8px 0 0 0",
                fontSize: "11px",
                fontStyle: "italic",
              }}
            >
              (Keys never leave this tab's local storage)
            </p>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--text-primary)",
              }}
            >
              API Key ID:
            </label>
            <input
              type="text"
              placeholder="Enter your API Key ID"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck="false"
              autoCorrect="off"
              autoCapitalize="off"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid var(--border-primary)",
                borderRadius: "4px",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "12px",
                boxSizing: "border-box",
                fontFamily: "Monaco, Menlo, Ubuntu Mono, monospace",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--text-primary)",
              }}
            >
              API Secret:
            </label>
            <input
              type="password"
              placeholder="Enter your API secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              autoComplete="off"
              spellCheck="false"
              autoCorrect="off"
              autoCapitalize="off"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid var(--border-primary)",
                borderRadius: "4px",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "12px",
                boxSizing: "border-box",
                fontFamily: "Monaco, Menlo, Ubuntu Mono, monospace",
              }}
            />
          </div>

          {isValidating && (
            <div
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-primary)",
                borderRadius: "4px",
                padding: "12px",
                marginBottom: "16px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                🔄 Validating credentials...
              </div>
            </div>
          )}

          {validationStatus && (
            <div
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: `1px solid ${validationStatus.isValid ? "#4ade80" : "#ef4444"}`,
                borderRadius: "4px",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  color: validationStatus.isValid ? "#4ade80" : "#ef4444",
                  fontSize: "12px",
                  fontWeight: "500",
                  marginBottom: validationStatus.email ? "4px" : "0",
                }}
              >
                {validationStatus.message}
              </div>
              {validationStatus.email && (
                <div
                  style={{ color: "var(--text-secondary)", fontSize: "11px" }}
                >
                  Associated email: {validationStatus.email}
                </div>
              )}
            </div>
          )}

          {/* Step 1 Action Buttons */}
          <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
            {/* Clear button - always visible */}
            <button
              onClick={() => {
                // Clear from localStorage first
                try {
                  localStorage.removeItem("sendsafely_config");
                } catch (e) {
                  console.error("Failed to clear SendSafely config:", e);
                }
                // Then clear form state
                setApiKey("");
                setApiSecret("");
                setValidationStatus(null);
                setShowValidateButton(true);
                setShowSaveButton(false);
              }}
              style={{
                flex: "1",
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                background: "var(--background)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Clear
            </button>

            {/* Validate button - visible by default, hidden when validation succeeds */}
            {showValidateButton && (
              <button
                onClick={() => {
                  const HARDCODED_HOST = "https://cockroachlabs.sendsafely.com";
                  if (apiKey && apiSecret) {
                    validateCredentials(HARDCODED_HOST, apiKey, apiSecret);
                  }
                }}
                disabled={!apiKey.trim() || !apiSecret.trim() || isValidating}
                style={{
                  flex: "2",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  background:
                    !apiKey.trim() || !apiSecret.trim() || isValidating
                      ? "var(--background)"
                      : "var(--accent-secondary)",
                  color:
                    !apiKey.trim() || !apiSecret.trim() || isValidating
                      ? "var(--text-muted)"
                      : "white",
                  cursor:
                    !apiKey.trim() || !apiSecret.trim() || isValidating
                      ? "not-allowed"
                      : "pointer",
                  fontSize: "12px",
                  opacity:
                    !apiKey.trim() || !apiSecret.trim() || isValidating
                      ? 0.6
                      : 1,
                }}
              >
                {isValidating ? "Validating..." : "Validate"}
              </button>
            )}

            {/* Save & Continue button - hidden by default, shown when validation succeeds */}
            {showSaveButton && (
              <button
                onClick={() => {
                  saveCredentials(apiKey, apiSecret);
                  setCredentialsSaved(true);
                  setForceStep1(false);
                }}
                style={{
                  flex: "2",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  background: "var(--accent-primary)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Save & Continue
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 2: URL Entry/Validation */}
      {step2_needsUrl && (
        <div>
          {/* Only show instructions if URL is invalid or we have an error */}
          {(!parsedUrl || packageError) && (
            <div
              style={{
                marginBottom: "16px",
                fontSize: "12px",
                lineHeight: "1.5",
              }}
            >
              <p style={{ margin: "0 0 12px 0" }}>
                To browse a SendSafely package, you need a URL with both
                packageCode and keycode.
              </p>

              <div
                style={{
                  margin: "12px 0",
                  padding: "12px",
                  backgroundColor: "var(--bg-tertiary)",
                  borderRadius: "4px",
                }}
              >
                <strong>Instructions:</strong>
                <ol style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                  <li>Open the SendSafely link in a new tab</li>
                  <li>Look for the chain icon (🔗) or "Show Link" button</li>
                  <li>Click it to reveal the package browsing link</li>
                  <li>Copy that link and paste it below</li>
                </ol>
              </div>
            </div>
          )}

          {/* Error display */}
          {(packageError || (!parsedUrl && sendSafelyModalUrl.trim())) && (
            <div
              style={{
                color: "var(--text-primary)",
                padding: "12px",
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: "4px",
                fontSize: "12px",
                marginBottom: "16px",
                border: "1px solid var(--border-primary)",
              }}
            >
              {packageError ||
                (() => {
                  if (!sendSafelyModalUrl.trim()) return "Please enter a URL";

                  const url = sendSafelyModalUrl;
                  const hasRecipientCode = url.includes("recipientCode=");
                  const hasPackageCode = url.includes("packageCode=");
                  const hasKeycode = url.includes("keycode=");

                  if (hasRecipientCode) {
                    return "Recipient link detected - use instructions above to get package link";
                  } else if (!hasPackageCode && !hasKeycode) {
                    return "URL is missing both packageCode and keycode";
                  } else if (!hasPackageCode) {
                    return "URL is missing packageCode";
                  } else if (!hasKeycode) {
                    return "URL is missing keycode";
                  } else {
                    return "Invalid URL format";
                  }
                })()}
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--text-primary)",
              }}
            >
              Package Link:
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="https://uploads.cockroachlabs.com/receive/?packageCode=..."
                value={sendSafelyModalUrl}
                onChange={(e) => setSendSafelyModalUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !packageLoading) {
                    attemptPackageLoad(sendSafelyModalUrl);
                  }
                }}
                disabled={packageLoading}
                style={{
                  flex: 1,
                  padding: "8px",
                  border: `1px solid ${packageError || (!parseSendSafelyUrl(sendSafelyModalUrl) && sendSafelyModalUrl.trim()) ? "#ef4444" : "var(--border-primary)"}`,
                  borderRadius: "4px",
                  backgroundColor: packageLoading
                    ? "var(--bg-secondary)"
                    : "var(--bg-tertiary)",
                  color: packageLoading
                    ? "var(--text-muted)"
                    : "var(--text-primary)",
                  fontSize: "12px",
                  boxSizing: "border-box",
                  opacity: packageLoading ? 0.6 : 1,
                }}
              />
              <button
                onClick={() => attemptPackageLoad(sendSafelyModalUrl)}
                disabled={
                  !parseSendSafelyUrl(sendSafelyModalUrl) || packageLoading
                }
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "4px",
                  backgroundColor:
                    parseSendSafelyUrl(sendSafelyModalUrl) && !packageLoading
                      ? "var(--accent-primary)"
                      : "var(--bg-secondary)",
                  color:
                    parseSendSafelyUrl(sendSafelyModalUrl) && !packageLoading
                      ? "white"
                      : "var(--text-muted)",
                  fontSize: "14px",
                  cursor:
                    parseSendSafelyUrl(sendSafelyModalUrl) && !packageLoading
                      ? "pointer"
                      : "not-allowed",
                  opacity:
                    parseSendSafelyUrl(sendSafelyModalUrl) && !packageLoading
                      ? 1
                      : 0.6,
                  minWidth: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {packageLoading ? (
                  <span className="loading-spinner-small" />
                ) : (
                  "→"
                )}
              </button>
            </div>
          </div>

          {/* Link to configure API credentials */}
          <div style={{ marginTop: "12px", textAlign: "center" }}>
            <button
              onClick={() => {
                setForceStep1(true);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "11px",
                cursor: "pointer",
                textDecoration: "underline",
                padding: "2px 0",
              }}
            >
              Configure API keys
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Package Loaded - Pick a File */}
      {step3_packageReady && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <button
              onClick={() => {
                // Go back to URL entry step - clear parsedUrl to force step 2
                setPackageInfo(null);
                setPackageError(null);
                setPackageLoading(false);
                setSendSafelyModalUrl(""); // Clear URL to ensure we're in step 2
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "16px",
                cursor: "pointer",
                padding: "4px 8px 4px 0",
                marginRight: "8px",
              }}
              title="Go back to URL entry"
            >
              ←
            </button>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "var(--text-primary)",
              }}
            >
              Upload from {packageInfo.packageSender || "Unknown sender"}
            </div>
          </div>

          {(() => {
            const zipFiles = packageInfo.files.filter((file: PackageFile) =>
              file.fileName.toLowerCase().endsWith(".zip"),
            );
            const otherFiles = packageInfo.files.filter(
              (file: PackageFile) =>
                !file.fileName.toLowerCase().endsWith(".zip"),
            );

            const renderFileItem = (file: PackageFile) => {
              const isZipFile = file.fileName.toLowerCase().endsWith(".zip");
              // Non-zip files that still have ".zip" somewhere in the name (e.g.
              // foo-bar.zip.tmp) may be a (partial) zip that just lacks the
              // extension, so offer to try opening them as a zip anyway.
              const canTryAsZip =
                !isZipFile && file.fileName.toLowerCase().includes(".zip");

              const startLoad = async (force: boolean) => {
                // Load SendSafely file through worker manager
                setFileLoading(true);
                setFileError(null);
                setLoading(true);
                setLoadingMessage("Preparing to load SendSafely file...");
                try {
                  await loadSendSafelyFile(file, force);
                  // Note: Don't close modal here - it will be closed by:
                  // 1. User clicking "Proceed" button if recovery warning is shown
                  // 2. Normal flow via onLoadingStage if no recovery warning
                } catch (error) {
                  setFileError(
                    error instanceof Error
                      ? error.message
                      : "Unknown error occurred",
                  );
                  setLoading(false);
                  setFileLoading(false);
                }
              };

              return (
                <div
                  key={file.fileId}
                  style={{
                    padding: "8px",
                    marginBottom: "4px",
                    backgroundColor: "var(--bg-tertiary)",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: isZipFile ? "pointer" : "default",
                    border: "1px solid transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onMouseEnter={
                    isZipFile
                      ? (e) => {
                          e.currentTarget.style.border =
                            "1px solid var(--accent-primary)";
                        }
                      : undefined
                  }
                  onMouseLeave={
                    isZipFile
                      ? (e) => {
                          e.currentTarget.style.border =
                            "1px solid transparent";
                        }
                      : undefined
                  }
                  onClick={isZipFile ? () => startLoad(false) : undefined}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
                      {file.fileName}
                    </div>
                    <div style={{ color: "var(--text-muted)" }}>
                      {file.fileUploaded && (
                        <span>
                          {new Date(file.fileUploaded).toLocaleDateString()}{" "}
                          •{" "}
                        </span>
                      )}
                      {(() => {
                        const sizeInMB = file.fileSize / 1024 / 1024;
                        if (sizeInMB >= 1024) {
                          return `${(sizeInMB / 1024).toFixed(2)} GB`;
                        } else {
                          return `${sizeInMB.toFixed(2)} MB`;
                        }
                      })()}
                      {canTryAsZip && (
                        <>
                          {" • "}
                          <span
                            role="link"
                            onClick={(e) => {
                              e.stopPropagation();
                              startLoad(true);
                            }}
                            style={{
                              color: "var(--accent-primary)",
                              textDecoration: "underline",
                              cursor: "pointer",
                            }}
                          >
                            try to open as .zip
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {isZipFile && (
                    <div
                      style={{
                        color: "var(--accent-primary)",
                        fontSize: "14px",
                        marginLeft: "8px",
                        opacity: 0.7,
                      }}
                    >
                      →
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div style={{ maxHeight: "300px", overflow: "auto" }}>
                {/* ZIP Files Section */}
                {zipFiles.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        marginBottom: "8px",
                        color: "var(--text-primary)",
                      }}
                    >
                      ZIP Files ({zipFiles.length}):
                    </div>
                    {zipFiles.map(renderFileItem)}
                  </div>
                )}

                {/* Other Files Section */}
                {otherFiles.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        marginBottom: "8px",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      onClick={() => setShowOtherFiles(!showOtherFiles)}
                    >
                      <span style={{ fontSize: "10px" }}>
                        {showOtherFiles ? "▼" : "▶"}
                      </span>
                      Other Files ({otherFiles.length})
                    </div>
                    {showOtherFiles && otherFiles.map(renderFileItem)}
                  </div>
                )}
              </div>
            );
          })()}

          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "4px",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            Click any ZIP file above to load it for analysis.
          </div>
        </div>
      )}

      {/* Step 4: File Loading/Error State */}
      {step4_fileLoading && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <button
              onClick={() => {
                // Go back to package selection
                setFileLoading(false);
                setFileError(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "16px",
                cursor: "pointer",
                padding: "4px 8px 4px 0",
                marginRight: "8px",
              }}
              title="Go back to file selection"
            >
              ←
            </button>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "var(--text-primary)",
              }}
            >
              {fileLoading ? "Loading file..." : "File loading failed"}
            </div>
          </div>

          {fileLoading && (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <span className="loading-spinner-small" />
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                {loadingMessage || "Loading ZIP file metadata..."}
              </div>
            </div>
          )}

          {fileError && (
            <div
              style={{
                color: "var(--accent-danger)",
                padding: "16px",
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: "4px",
                fontSize: "12px",
                border: "1px solid #ef4444",
                marginBottom: "16px",
              }}
            >
              <strong>Error:</strong> {fileError}
            </div>
          )}

          {fileError && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setFileLoading(false);
                  setFileError(null);
                }}
                style={{
                  padding: "8px 16px",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  backgroundColor: "var(--accent-primary)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DropZone() {
  const { dispatch, state, waitForWorkers } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sendSafelyUrl, setSendSafelyUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [validationStatus, setValidationStatus] = useState<{
    isValid: boolean;
    message: string;
    email?: string;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Single SendSafely modal state
  const [showSendSafelyModal, setShowSendSafelyModal] = useState(false);
  const [sendSafelyModalUrl, setSendSafelyModalUrl] = useState("");
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [modalDismissable, setModalDismissable] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  // CD recovery warning state is now in global state (not local)

  // Single function to close the SendSafely modal
  const closeSendSafelyModal = useCallback(() => {
    setShowSendSafelyModal(false);
    setValidationStatus(null);
    setPackageInfo(null);
    setPackageError(null);
    setPackageLoading(false);
    setFileLoading(false);
    // Note: don't reset recoveryInfo - it persists to show banner after modal closes
  }, []);

  // Debug page state
  const [showDebugPage, setShowDebugPage] = useState(false);
  const [debugEndpoint, setDebugEndpoint] = useState("");
  const [debugBody, setDebugBody] = useState("");
  const [debugResult, setDebugResult] = useState("");
  const [debugLoading, setDebugLoading] = useState(false);

  // Legacy modal states (to be removed once unified modal is complete)
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [canonicalLinkInput, setCanonicalLinkInput] = useState("");
  // Check if we should show loading state (either local loading or tables loading)
  const isLoading = loading || state.tablesLoading;

  // localStorage helpers
  const getSavedCredentials = () => {
    try {
      const saved = localStorage.getItem("sendsafely_config");
      if (saved) {
        const config = JSON.parse(saved);
        return {
          key: config.key || "",
          secret: config.secret || "",
        };
      }
    } catch (e) {
      console.error("Failed to parse SendSafely config:", e);
    }
    return { key: "", secret: "" };
  };

  const saveCredentials = (key: string, secret: string) => {
    try {
      // SendSafely's app-specific API keys cannot be re-read after they are created, so we need to save this
      // app-specific key they just generated for us in local persistent storage for future use or else the user
      // will need to manually generate a new app-specific API every time they need to load a zip. This is strictly
      // to *local* storage akin to locally saved API configuration users already have e.g. for the CLI file downloader tool.
      localStorage.setItem(
        "sendsafely_config",
        JSON.stringify({ key, secret }),
      );
    } catch (e) {
      console.error("Failed to save SendSafely config:", e);
    }
  };

  const hasValidCredentials = useCallback(() => {
    const { key, secret } = getSavedCredentials();
    return key.length === 22 && secret.length === 22;
  }, []);

  const executeDebugApiCall = async () => {
    if (!debugEndpoint.trim()) {
      setDebugResult("Error: Endpoint is required");
      return;
    }

    const { key, secret } = getSavedCredentials();
    if (!key || !secret) {
      setDebugResult("Error: No saved API credentials");
      return;
    }

    setDebugLoading(true);
    setDebugResult("Making API call...");

    try {
      const host = "https://cockroachlabs.sendsafely.com";
      const client = createSendSafelyClient(host, key, secret);

      // Determine method based on whether body is provided
      const method = debugBody.trim() ? "POST" : "GET";
      let body = undefined;
      if (debugBody.trim()) {
        try {
          body = JSON.parse(debugBody);
        } catch (e) {
          setDebugResult(
            `Error: Invalid JSON in body - ${e instanceof Error ? e.message : "Unknown error"}`,
          );
          setDebugLoading(false);
          return;
        }
      }

      // Debug API call

      // Use the client's makeRequest method (we need to make it accessible)
      const response = await client.makeRequest(method, debugEndpoint, body);

      setDebugResult(JSON.stringify(response, null, 2));
      // Debug API response received
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setDebugResult(`Error: ${errorMessage}`);
      // Debug API error handled
    } finally {
      setDebugLoading(false);
    }
  };

  const loadSendSafelyFile = async (file: PackageFile, force = false) => {
    if (!force && !file.fileName.toLowerCase().endsWith(".zip")) {
      throw new Error("Please select a .zip file");
    }

    const { key, secret } = getSavedCredentials();
    const host = "https://cockroachlabs.sendsafely.com";
    const parsed = parseSendSafelyUrl(sendSafelyModalUrl);

    if (!parsed || !packageInfo) {
      throw new Error("Package information not available");
    }

    // Loading SendSafely file

    // Wait for workers to be ready
    let workerManager = state.workerManager;
    if (!state.workersReady || !workerManager) {
      // Waiting for workers to finish initializing
      workerManager = await waitForWorkers();

      if (!workerManager) {
        throw new Error("WorkerManager not available after initialization");
      }
    }

    // Set up the same callbacks as handleFile
    workerManager.updateCallbacks({
      onLoadingStage: (stage: string, message: string) => {
        setLoadingMessage(message);

        // Close modal when we move past ZIP loading phase
        if (stage === "table-loading" || stage === "complete" || stage === "error") {
          setLoading(false);
          closeSendSafelyModal();
        }
      },
      onCdScanningComplete: async (entriesCount: number) => {
        // ZIP recovery was used - store info for banner and auto-proceed
        dispatch({ type: "SET_RECOVERY_INFO", recoveryInfo: {entriesCount} });
        const workerManager = await waitForWorkers();
        await workerManager.proceedWithRecovery();
      },
      onSendStackFileToIframe: (path: string, content: string, name?: string) => {
        // Detect mode based on file path
        const isLabeled = path.includes("stacks_with_labels.txt");
        const isPerG = path.includes("stacks.txt") && !isLabeled;

        // Add to React state for UI logic (mode-specific)
        if (isPerG) {
          dispatch({ type: "ADD_STACK_FILE_PER_G", filePath: path, content: content });
        } else if (isLabeled) {
          dispatch({ type: "ADD_STACK_FILE_LABELED", filePath: path, content: content });
        }
        // Also update legacy stackData for backwards compatibility
        dispatch({ type: "ADD_STACK_FILE", filePath: path, content: content });

        // Send to appropriate iframe based on file type
        const iframeId = isLabeled ? "stackgazer-labeled" : "stackgazer-per-g";
        const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
        if (iframe?.contentWindow) {
          setTimeout(() => {
            try {
              iframe.contentWindow!.postMessage(
                {
                  type: "LOAD_STACK_FILE",
                  path: path,
                  name: name,
                  content: content,
                },
                window.location.origin,
              );
            } catch (error) {
              console.error("Error sending stack file to iframe:", error);
            }
          }, 10);
        }
      },
      onStackProcessingComplete: (_stackFilesCount: number) => {
        // Stack files have been loaded and sent to iframe
        // stackData should already be populated via ADD_STACK_FILE actions
        dispatch({ type: "SET_STACKGAZER_READY", ready: true });
      },
      onFileList: (entries: ZipEntryMeta[], _totalFiles: number) => {
        // Received file list

        (window as unknown as { __zipReader: unknown }).__zipReader =
          workerManager;

        dispatch({
          type: "SET_ZIP",
          name: file.fileName,
          size: file.fileSize,
          entries,
        });

        // Extract stack files from the file list (both stacks.txt and stacks_with_labels.txt)
        // Exclude files in cluster/ directory
        const stackFiles = entries
          .filter(
            (entry: ZipEntryMeta) =>
              !entry.isDir &&
              (entry.path.endsWith("stacks.txt") || entry.path.endsWith("stacks_with_labels.txt")) &&
              !entry.path.includes("/cluster/"),
          )
          .map((entry: ZipEntryMeta) => ({
            path: entry.path,
            size: entry.size,
            compressedSize: entry.compressedSize,
          }));

        if (stackFiles.length > 0) {
          dispatch({ type: "SET_STACK_DATA", stackData: {} });
          dispatch({ type: "SET_STACK_FILES", stackFiles });
          dispatch({ type: "SET_STACKGAZER_READY", ready: false });
        }

        dispatch({ type: "SET_TABLES_LOADING", loading: true });
      },
      onTableAdded: (table: TableData) => {
        dispatch({
          type: "REGISTER_TABLE",
          table: {
            name: table.name,
            sourceFile: table.sourceFile || table.path,
            loaded: table.loaded || false,
            size: table.size,
            nodeId: table.nodeId,
            originalName: table.originalName,
            isError: table.isError,
            nodeFiles: table.nodeFiles,
          },
        });
      },
      onIndexingProgress: (progress: {
        current: number;
        total: number;
        fileName: string;
      }) => {
        setLoadingMessage(
          `Indexing log files: ${progress.current}/${progress.total} - ${progress.fileName}`,
        );
      },
      onIndexingComplete: (
        success: boolean,
        _totalEntries: number,
        error?: string,
        ruleDescription?: string,
      ) => {
        dispatch({
          type: "SET_INDEXING_STATUS",
          status: success ? "ready" : "none",
          ruleDescription,
        });

        if (success) {
          setLoading(false);
          setLoadingMessage("");
        } else {
          console.error(`❌ DropZone: Indexing failed: ${error}`);
          setLoading(false);
          setError(`Indexing failed: ${error}`);
        }
      },
      onFileStatusUpdate: (fileStatuses: FileStatus[]) => {
        // Convert FileStatus to FileIndexStatus by adding missing fields
        const convertedStatuses = fileStatuses.map((status) => ({
          ...status,
          name: status.path.split("/").pop() || status.path,
          size: 0, // Size not available from FileStatus
          status: status.status as
            | "unindexed"
            | "indexing"
            | "indexed"
            | "error",
        }));
        dispatch({
          type: "SET_FILE_STATUSES",
          fileStatuses: convertedStatuses,
        });
      },
    });

    // Load the SendSafely file through the worker manager
    // Starting SendSafely file loading
    await workerManager.loadZipDataFromSendSafely({
      host,
      apiKey: key,
      apiSecret: secret,
      keyCode: parsed.keyCode,
      fileId: file.fileId,
      packageInfo: {
        ...packageInfo,
        keyCode: parsed.keyCode,
      },
    });

    // Don't close here - onLoadingStage will call closeSendSafelyModal when complete
  };

  const validateCredentials = async (
    host: string,
    key: string,
    secret: string,
  ) => {
    if (!host || key.length !== 22 || secret.length !== 22) {
      return;
    }

    setIsValidating(true);
    setValidationStatus(null);

    try {
      const client = createSendSafelyClient(host, key, secret);
      const userInfo = await client.verifyCredentials();

      setValidationStatus({
        isValid: true,
        message: `✅ Valid credentials`,
        email: userInfo.email,
      });
    } catch (error) {
      console.error("SendSafely validation error:", error);

      let message = "Unknown error occurred";

      if (error instanceof Error) {
        // Extract the actual error message from the response
        if (error.message.includes("HTTP")) {
          // HTTP errors like "HTTP 401: Authentication failed"
          message = error.message;
        } else if (error.message.includes("API response:")) {
          // SendSafely API errors like "API response: "AUTHENTICATION_FAILED", message: "Invalid API Key""
          const match = error.message.match(
            /API response: "([^"]+)"(?:, message: "([^"]+)")?/,
          );
          if (match) {
            message = match[2] || match[1]; // Use the message if available, otherwise the response code
          } else {
            message = error.message;
          }
        } else {
          // Other errors
          message = error.message;
        }
      }

      setValidationStatus({
        isValid: false,
        message: `❌ ${message}`,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSendSafelyUrlChange = (url: string) => {
    setSendSafelyUrl(url);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      // Open modal for any non-empty URL - let the modal handle validation
      if (url.trim()) {
        setSendSafelyModalUrl(url);
        setShowSendSafelyModal(true);
        // Reset state for new flow
        setPackageInfo(null);
        setPackageError(null);
        setPackageLoading(false);
      }
    }, 500);
  };

  const attemptPackageLoad = useCallback(
    async (url: string) => {
      const parsed = parseSendSafelyUrl(url);
      if (!parsed) {
        return; // URL doesn't have packageCode and keycode
      }

      const { key, secret } = getSavedCredentials();
      const host = "https://cockroachlabs.sendsafely.com";
      if (!hasValidCredentials()) {
        return; // Credentials not ready
      }

      // Prevent duplicate loads
      if (packageLoading) {
        return;
      }

      setPackageLoading(true);
      setPackageError(null);
      setPackageInfo(null);

      try {
        const client = createSendSafelyClient(host, key, secret);
        const packageInfo = await client.getPackageInfo(parsed.packageCode);
        setPackageInfo(packageInfo);
      } catch (error) {
        console.error("Failed to load package info:", error);
        setPackageError(
          error instanceof Error ? error.message : "Unknown error",
        );
      } finally {
        setPackageLoading(false);
      }
    },
    [
      hasValidCredentials,
      packageLoading,
      setPackageLoading,
      setPackageError,
      setPackageInfo,
    ],
  );

  const handleCanonicalLinkSubmit = () => {
    if (canonicalLinkInput.trim()) {
      setSendSafelyModalUrl(canonicalLinkInput);
      setShowLinkModal(false);
      attemptPackageLoad(canonicalLinkInput);
    }
  };

  // Load saved credentials when SendSafely modal opens
  useEffect(() => {
    if (showSendSafelyModal) {
      const { key, secret } = getSavedCredentials();
      setApiKey(key);
      setApiSecret(secret);

      // Clear validation status when modal opens to ensure fresh state
      setValidationStatus(null);

      // Prevent backdrop dismissal for 300ms to avoid accidental clicks
      setModalDismissable(false);
      const timer = setTimeout(() => {
        setModalDismissable(true);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [showSendSafelyModal]);

  // Auto-attempt package load when we have valid credentials and a valid URL
  useEffect(() => {
    if (showSendSafelyModal && hasValidCredentials()) {
      const parsed = parseSendSafelyUrl(sendSafelyModalUrl);
      if (parsed && !packageInfo && !packageLoading && !packageError) {
        // Only auto-load if we don't already have package info and aren't already loading
        attemptPackageLoad(sendSafelyModalUrl);
      }
    }
  }, [
    showSendSafelyModal,
    sendSafelyModalUrl,
    hasValidCredentials,
    packageInfo,
    packageLoading,
    packageError,
    attemptPackageLoad,
  ]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".zip")) {
        setError("Please select a .zip file");
        return;
      }

      setLoading(true);
      setLoadingMessage(
        `Reading ${file.name} (${(file.size / 1000 / 1000).toFixed(1)} MB)...`, // Decimal (matches macOS/Safari)
      );
      setError(null);

      try {
        // Wait for workers to be ready (they're initializing eagerly in background)
        let workerManager = state.workerManager;
        if (!state.workersReady || !workerManager) {
          // Waiting for workers to finish initializing
          setLoadingMessage("Setting up background processing...");

          // Wait for workers that are already initializing
          workerManager = await waitForWorkers();

          if (!workerManager) {
            throw new Error("WorkerManager not available after initialization");
          }
        }

        // Set up callbacks to listen for controller notifications BEFORE starting load
        workerManager.updateCallbacks({
          onLoadingStage: (stage: string, message: string) => {
            setLoadingMessage(message);

            if (stage === "complete" || stage === "error") {
              setLoading(false);
            }

            // Stack data is now sent directly by controller via onSendStackDataToIframe callback
          },
          onCdScanningComplete: async (entriesCount: number) => {
            // ZIP recovery was used - store info for banner and auto-proceed
            dispatch({ type: "SET_RECOVERY_INFO", recoveryInfo: {entriesCount} });
            await workerManager.proceedWithRecovery();
          },
          onSendStackFileToIframe: (path: string, content: string, name?: string) => {
            // Detect mode based on file path
            const isLabeled = path.includes("stacks_with_labels.txt");
            const isPerG = path.includes("stacks.txt") && !isLabeled;

            // Add to React state for UI logic (mode-specific)
            if (isPerG) {
              dispatch({ type: "ADD_STACK_FILE_PER_G", filePath: path, content: content });
            } else if (isLabeled) {
              dispatch({ type: "ADD_STACK_FILE_LABELED", filePath: path, content: content });
            }
            // Also update legacy stackData for backwards compatibility
            dispatch({
              type: "ADD_STACK_FILE",
              filePath: path,
              content: content,
            });

            // Send to appropriate iframe based on file type
            const iframeId = isLabeled ? "stackgazer-labeled" : "stackgazer-per-g";
            const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
            if (iframe?.contentWindow) {
              setTimeout(() => {
                try {
                  iframe.contentWindow!.postMessage(
                    {
                      type: "LOAD_STACK_FILE",
                      path: path,
                      name: name,
                      content: content,
                    },
                    window.location.origin,
                  );
                } catch (error) {
                  console.error("Error sending stack file to iframe:", error);
                }
              }, 10); // Shorter delay since we're sending one file at a time
            }
          },
          onStackProcessingComplete: (_stackFilesCount: number) => {
            // Stack files have been loaded and sent to iframe
            // stackData should already be populated via ADD_STACK_FILE actions
            dispatch({ type: "SET_STACKGAZER_READY", ready: true });
          },
          onFileList: (entries: ZipEntryMeta[]) => {
            // Received file list

            // Set window.__zipReader for backward compatibility with FileViewer
            (window as unknown as { __zipReader: unknown }).__zipReader =
              workerManager;

            dispatch({
              type: "SET_ZIP",
              name: file.name,
              size: file.size,
              entries,
            });

            // Extract stack files from the file list (both stacks.txt and stacks_with_labels.txt)
            // Exclude files in cluster/ directory
            const stackFiles = entries
              .filter(
                (entry: ZipEntryMeta) =>
                  !entry.isDir &&
                  (entry.path.endsWith("stacks.txt") || entry.path.endsWith("stacks_with_labels.txt")) &&
                  !entry.path.includes("/cluster/"),
              )
              .map((entry: ZipEntryMeta) => ({
                path: entry.path,
                size: entry.size,
                compressedSize: entry.compressedSize,
              }));

            if (stackFiles.length > 0) {
              dispatch({ type: "SET_STACK_DATA", stackData: {} });
              dispatch({ type: "SET_STACK_FILES", stackFiles });
              dispatch({ type: "SET_STACKGAZER_READY", ready: false });
            }

            // Set tables loading state - controller will start loading them
            dispatch({ type: "SET_TABLES_LOADING", loading: true });
          },
          onTableAdded: (table: TableData) => {
            // Controller already prepared the table, just register it
            dispatch({
              type: "REGISTER_TABLE",
              table: {
                name: table.name,
                sourceFile: table.sourceFile || table.path,
                loaded: table.loaded || false,
                size: table.size,
                nodeId: table.nodeId,
                originalName: table.originalName,
                isError: table.isError,
                nodeFiles: table.nodeFiles,
              },
            });
          },
          onIndexingProgress: (progress: {
            current: number;
            total: number;
            fileName: string;
          }) => {
            setLoadingMessage(
              `Indexing log files: ${progress.current}/${progress.total} - ${progress.fileName}`,
            );
          },
          onIndexingComplete: (
            success: boolean,
            _totalEntries: number,
            error?: string,
            ruleDescription?: string,
          ) => {
            // Update global indexing status for SearchView to access
            dispatch({
              type: "SET_INDEXING_STATUS",
              status: success ? "ready" : "none",
              ruleDescription,
            });

            if (success) {
              // Indexing completed successfully
              // Clear loading state since indexing is complete
              setLoading(false);
              setLoadingMessage("");
            } else {
              console.error(`❌ DropZone: Indexing failed: ${error}`);
              setLoading(false);
              setError(`Indexing failed: ${error}`);
            }
          },
          onFileStatusUpdate: (fileStatuses: FileStatus[]) => {
            // Convert FileStatus to FileIndexStatus by adding missing fields
            const convertedStatuses = fileStatuses.map((status) => ({
              ...status,
              name: status.path.split("/").pop() || status.path,
              size: 0, // Size not available from FileStatus
              status: status.status as
                | "unindexed"
                | "indexing"
                | "indexed"
                | "error",
            }));
            dispatch({
              type: "SET_FILE_STATUSES",
              fileStatuses: convertedStatuses,
            });
          },
        });

        // Just trigger the loading - controller will drive everything from here
        // For large files, pass the File object directly to avoid loading into memory
        // Starting controller-driven pipeline
        await workerManager.loadZipFile(file);
      } catch (err) {
        console.error("Failed to read zip:", err);
        setError(
          `Failed to read zip: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        setLoading(false);
      }
    },
    [
      setError,
      setLoading,
      setLoadingMessage,
      state.workerManager,
      state.workersReady,
      waitForWorkers,
      dispatch,
    ],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const loadDemoFile = useCallback(async () => {
    setLoading(true);
    setLoadingMessage("Loading demo file...");
    setError(null);

    try {
      // Use relative path that works in both dev and production
      const response = await fetch(
        `${import.meta.env.BASE_URL}debug_renamed.zip`,
      );
      if (!response.ok) {
        throw new Error("Failed to load demo file");
      }
      const arrayBuffer = await response.arrayBuffer();
      const file = new File([arrayBuffer], "debug_renamed.zip", {
        type: "application/zip",
      });
      handleFile(file);
    } catch (err) {
      console.error("Failed to load demo file:", err);
      setError(
        `Failed to load demo file: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      setLoading(false);
    }
  }, [handleFile]);

  return (
    <div
      className={`drop-zone ${isDragging ? "dragover" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        id="file-input"
        type="file"
        accept=".zip"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      <div className="drop-message">
        {isLoading ? (
          <p style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="loading-spinner-small" />
            {loadingMessage || "Loading tables..."}
          </p>
        ) : error ? (
          <>
            <h2 style={{ color: "var(--accent-danger)" }}>Error</h2>
            <p>{error}</p>
            <button className="btn" onClick={() => setError(null)}>
              Try Again
            </button>
          </>
        ) : (
          <>
            <h2>📦 Drop a debug.zip here</h2>
            <p>
              ...or{" "}
              <span
                style={{
                  color: "var(--accent-primary)",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById("file-input")?.click();
                }}
              >
                browse and select
              </span>{" "}
              a file
            </p>
            <div style={{ margin: "1rem 0", fontSize: "0.9rem" }}>
              <p style={{ marginBottom: "0.5rem" }}>
                ...or paste a SendSafely link to browse a remote zip:
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <input
                  type="text"
                  placeholder="https://uploads.cockroachlabs.com/receive/?packageCode=..."
                  value={sendSafelyUrl}
                  onChange={(e) => handleSendSafelyUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && sendSafelyUrl.trim()) {
                      // Clear any pending debounce and open modal immediately
                      if (debounceTimeout.current) {
                        clearTimeout(debounceTimeout.current);
                      }
                      setSendSafelyModalUrl(sendSafelyUrl);
                      setShowSendSafelyModal(true);
                      setPackageInfo(null);
                      setPackageError(null);
                      setPackageLoading(false);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 0.8,
                    padding: "6px 8px",
                    background: "var(--bg-quaternary)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "4px",
                    color: "var(--text-primary)",
                    fontFamily: "inherit",
                    fontSize: "12px",
                    transition: "border-color 0.2s ease, background 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--accent-primary)";
                    e.target.style.background = "var(--bg-primary)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--border-primary)";
                    e.target.style.background = "var(--bg-quaternary)";
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (debounceTimeout.current) {
                      clearTimeout(debounceTimeout.current);
                    }
                    setSendSafelyModalUrl(sendSafelyUrl);
                    setShowSendSafelyModal(true);
                    setPackageInfo(null);
                    setPackageError(null);
                    setPackageLoading(false);
                  }}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "4px",
                    background: sendSafelyUrl.trim()
                      ? "var(--accent-primary)"
                      : "var(--bg-tertiary)",
                    color: sendSafelyUrl.trim()
                      ? "white"
                      : "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "all 0.2s ease",
                  }}
                  title={
                    sendSafelyUrl.trim()
                      ? "Open SendSafely package"
                      : "Configure SendSafely settings"
                  }
                  onMouseEnter={(e) => {
                    if (sendSafelyUrl.trim()) {
                      e.currentTarget.style.background =
                        "var(--accent-primary-hover)";
                    } else {
                      e.currentTarget.style.background = "var(--bg-quaternary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = sendSafelyUrl.trim()
                      ? "var(--accent-primary)"
                      : "var(--bg-tertiary)";
                  }}
                >
                  →
                </button>
              </div>
            </div>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                marginTop: "0.75rem",
              }}
            >
              all processing executes locally -- nothing is uploaded
            </p>

            <div style={{ marginTop: "0.75rem" }}>
              <button
                className="btn btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  loadDemoFile();
                }}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.5rem 1rem",
                  background: "var(--accent-muted)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                Try a demo with an example zip file 🚀
              </button>
            </div>
          </>
        )}
      </div>

      {/* Unified SendSafely Modal */}
      {showSendSafelyModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--bg-overlay)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => {
            if (modalDismissable) {
              closeSendSafelyModal();
            }
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-primary)",
                backgroundColor: "var(--bg-tertiary)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h2
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--accent-primary)",
                    margin: 0,
                  }}
                >
                  SendSafely Package Access
                </h2>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <button
                    onClick={() => setShowDebugPage(!showDebugPage)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-secondary)",
                      fontSize: "14px",
                      cursor: "pointer",
                      padding: "4px",
                      lineHeight: "1",
                      display: "none",
                    }}
                    title="Debug API calls"
                  >
                    🔧🔨
                  </button>
                  <button
                    onClick={() => {
                      closeSendSafelyModal();
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-secondary)",
                      fontSize: "18px",
                      cursor: "pointer",
                      padding: "0 4px",
                      lineHeight: "1",
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            {/* Debug Page or Normal Modal Content */}
            {showDebugPage ? (
              <div
                style={{
                  padding: "16px",
                  overflow: "auto",
                  maxHeight: "calc(80vh - 60px)",
                }}
              >
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "var(--text-primary)",
                    }}
                  >
                    Endpoint (e.g., /api/v2.0/user):
                  </label>
                  <input
                    type="text"
                    placeholder="/api/v2.0/user"
                    value={debugEndpoint}
                    onChange={(e) => setDebugEndpoint(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "4px",
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                      boxSizing: "border-box",
                      fontFamily: "Monaco, Menlo, Ubuntu Mono, monospace",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "var(--text-primary)",
                    }}
                  >
                    Body (JSON, leave empty for GET):
                  </label>
                  <textarea
                    placeholder='{"key": "value"}'
                    value={debugBody}
                    onChange={(e) => setDebugBody(e.target.value)}
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "4px",
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                      boxSizing: "border-box",
                      fontFamily: "Monaco, Menlo, Ubuntu Mono, monospace",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <button
                    onClick={executeDebugApiCall}
                    disabled={debugLoading || !debugEndpoint.trim()}
                    style={{
                      padding: "8px 16px",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "4px",
                      backgroundColor:
                        !debugLoading && debugEndpoint.trim()
                          ? "var(--accent-primary)"
                          : "var(--bg-secondary)",
                      color:
                        !debugLoading && debugEndpoint.trim()
                          ? "white"
                          : "var(--text-muted)",
                      fontSize: "12px",
                      cursor:
                        !debugLoading && debugEndpoint.trim()
                          ? "pointer"
                          : "not-allowed",
                      opacity: !debugLoading && debugEndpoint.trim() ? 1 : 0.6,
                    }}
                  >
                    {debugLoading
                      ? "Calling..."
                      : `${debugBody.trim() ? "POST" : "GET"} Request`}
                  </button>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "var(--text-primary)",
                    }}
                  >
                    Result:
                  </label>
                  <textarea
                    value={debugResult}
                    readOnly
                    rows={12}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "4px",
                      backgroundColor: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      fontSize: "11px",
                      boxSizing: "border-box",
                      fontFamily: "Monaco, Menlo, Ubuntu Mono, monospace",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "var(--bg-tertiary)",
                    borderRadius: "4px",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  <strong>Usage:</strong>
                  <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px" }}>
                    <li>Leave body empty for GET requests</li>
                    <li>Add JSON body for POST requests</li>
                    <li>
                      All requests are automatically signed with saved API
                      credentials
                    </li>
                    <li>
                      Check browser console for detailed request/response logs
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <SendSafelyModalContent
                hasValidCredentials={hasValidCredentials}
                sendSafelyModalUrl={sendSafelyModalUrl}
                setSendSafelyModalUrl={setSendSafelyModalUrl}
                attemptPackageLoad={attemptPackageLoad}
                apiKey={apiKey}
                setApiKey={setApiKey}
                apiSecret={apiSecret}
                setApiSecret={setApiSecret}
                isValidating={isValidating}
                validationStatus={validationStatus}
                setValidationStatus={setValidationStatus}
                saveCredentials={saveCredentials}
                packageLoading={packageLoading}
                packageError={packageError}
                packageInfo={packageInfo}
                setPackageInfo={setPackageInfo}
                setPackageError={setPackageError}
                setPackageLoading={setPackageLoading}
                parsedUrl={parseSendSafelyUrl(sendSafelyModalUrl)}
                validateCredentials={validateCredentials}
                loadSendSafelyFile={loadSendSafelyFile}
                setLoading={setLoading}
                loadingMessage={loadingMessage}
                setLoadingMessage={setLoadingMessage}
                fileLoading={fileLoading}
                setFileLoading={setFileLoading}
              />
            )}
          </div>
        </div>
      )}

      {/* Package Listing Modal */}
      {showPackageModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--bg-overlay)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowPackageModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-primary)",
                backgroundColor: "var(--bg-tertiary)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--accent-primary)",
                  margin: 0,
                }}
              >
                SendSafely Package Contents
              </h2>
              <button
                onClick={() => setShowPackageModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: "18px",
                  cursor: "pointer",
                  padding: "0 4px",
                  lineHeight: "1",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "16px",
                overflow: "auto",
                maxHeight: "calc(80vh - 60px)",
              }}
            >
              {packageLoading && (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <span className="loading-spinner-small" />
                  <div style={{ marginTop: "8px", fontSize: "12px" }}>
                    Loading package information...
                  </div>
                </div>
              )}

              {packageError && (
                <div
                  style={{
                    color: "var(--accent-danger)",
                    padding: "16px",
                    backgroundColor: "var(--bg-tertiary)",
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  <strong>Error:</strong> {packageError}
                </div>
              )}

              {packageInfo && (
                <div>
                  <div style={{ marginBottom: "16px", fontSize: "12px" }}>
                    <strong>Package ID:</strong> {packageInfo.packageId}
                    <br />
                    <strong>Package Code:</strong> {packageInfo.packageCode}
                  </div>

                  <div
                    style={{
                      marginBottom: "8px",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    Files ({packageInfo.files.length}):
                  </div>

                  <div style={{ maxHeight: "300px", overflow: "auto" }}>
                    {packageInfo.files.map((file) => (
                      <div
                        key={file.fileId}
                        style={{
                          padding: "8px",
                          marginBottom: "4px",
                          backgroundColor: "var(--bg-tertiary)",
                          borderRadius: "4px",
                          fontSize: "11px",
                        }}
                      >
                        <div
                          style={{ fontWeight: "bold", marginBottom: "2px" }}
                        >
                          {file.fileName}
                        </div>
                        <div style={{ color: "var(--text-muted)" }}>
                          Size: {(file.fileSize / 1000 / 1000).toFixed(2)} MB {/* Decimal (matches macOS/Safari) */}
                          {file.createdDate && (
                            <span style={{ marginLeft: "8px" }}>
                              Created:{" "}
                              {new Date(file.createdDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      marginTop: "16px",
                      padding: "12px",
                      backgroundColor: "var(--bg-tertiary)",
                      borderRadius: "4px",
                      fontSize: "11px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Note: File downloading from SendSafely is not yet
                    implemented.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link Conversion Modal */}
      {showLinkModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--bg-overlay)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowLinkModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-primary)",
                backgroundColor: "var(--bg-tertiary)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--accent-primary)",
                  margin: 0,
                }}
              >
                Open SendSafely Link
              </h2>
              <button
                onClick={() => setShowLinkModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: "18px",
                  cursor: "pointer",
                  padding: "0 4px",
                  lineHeight: "1",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "16px",
                overflow: "auto",
                maxHeight: "calc(80vh - 60px)",
              }}
            >
              <div
                style={{
                  marginBottom: "16px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                }}
              >
                <p style={{ margin: "0 0 12px 0" }}>
                  This is a recipient download link. To browse the package
                  contents, you need the canonical package link.
                </p>

                <div
                  style={{
                    margin: "12px 0",
                    padding: "12px",
                    backgroundColor: "var(--bg-tertiary)",
                    borderRadius: "4px",
                  }}
                >
                  <strong>Instructions:</strong>
                  <ol style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                    <li>Open the SendSafely link in a new tab</li>
                    <li>Look for the chain icon (🔗) or "Show Link" button</li>
                    <li>Click it to reveal the canonical package link</li>
                    <li>Copy that link and paste it below</li>
                  </ol>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: "var(--text-primary)",
                  }}
                >
                  Canonical Package Link:
                </label>
                <input
                  type="text"
                  placeholder="https://uploads.cockroachlabs.com/receive/?packageCode=..."
                  value={canonicalLinkInput}
                  onChange={(e) => setCanonicalLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCanonicalLinkSubmit();
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "4px",
                    backgroundColor: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border-primary)",
                backgroundColor: "var(--bg-tertiary)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                onClick={() => setShowLinkModal(false)}
                style={{
                  padding: "6px 12px",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCanonicalLinkSubmit}
                disabled={!canonicalLinkInput.trim()}
                style={{
                  padding: "6px 12px",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "4px",
                  backgroundColor: canonicalLinkInput.trim()
                    ? "var(--accent-primary)"
                    : "var(--bg-secondary)",
                  color: canonicalLinkInput.trim()
                    ? "white"
                    : "var(--text-muted)",
                  fontSize: "12px",
                  cursor: canonicalLinkInput.trim() ? "pointer" : "not-allowed",
                  opacity: canonicalLinkInput.trim() ? 1 : 0.6,
                }}
              >
                Load Package
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DropZone;
