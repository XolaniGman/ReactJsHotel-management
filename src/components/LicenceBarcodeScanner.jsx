import { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import './licenceBarcodeScanner.css';

/**
 * LicenceBarcodeScanner
 * -----------------------------------------------------------------------
 * Scans the barcode printed/embossed on an ID, licence or card — QR code,
 * PDF417, Code128, EAN-13, etc. — as a faster companion to DocumentScanner
 * (which reads the printed text/MRZ via OCR).
 *
 * IMPORTANT — what this can and can't actually read:
 * A plain QR/Code128/EAN barcode decodes to whatever text was encoded in
 * it, so those work as expected. But the PDF417 barcode on a genuine South
 * African driver's licence is NOT plain text — its payload is encrypted
 * per the RTMC/eNaTIS card specification, so a client-side scan can only
 * recover the raw encrypted bytes, not the licence number or any other
 * field. This component detects that case (the decoded value doesn't look
 * like printable text) and says so honestly instead of pretending to
 * extract fields from it — use the OCR-based DocumentScanner or manual
 * entry for real SA licences.
 * -----------------------------------------------------------------------
 */

// A real, deterministic check — not a simulation. Loosely normalized so
// formatting differences (spaces, dashes, case) don't cause false mismatches.
const normalize = (value) => (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Heuristic: does the decoded payload look like human-readable text, or
// binary/encrypted bytes? Printable ASCII + common whitespace, mostly.
const looksLikeReadableText = (value) => {
  if (!value) return false;
  const printable = value.replace(/[^\x20-\x7E]/g, '').length;
  return printable / value.length > 0.85;
};

export default function LicenceBarcodeScanner({ onResult, expectedIdNumber = '' }) {
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);

  const handleScan = (detectedCodes) => {
    if (!detectedCodes?.length || result) return;
    const { rawValue, format } = detectedCodes[0];
    const readable = looksLikeReadableText(rawValue);
    const candidateNumber = readable ? rawValue.trim() : null;

    const normalizedExpected = normalize(expectedIdNumber);
    const match = normalizedExpected && candidateNumber
      ? normalize(candidateNumber) === normalizedExpected
      : null;

    const payload = { rawValue, format, readable, candidateNumber, idNumberMatch: match };
    setResult(payload);
    setScanning(false);
    onResult?.(payload);
  };

  const reset = () => {
    setResult(null);
    setErrorMsg('');
    setScanning(false);
  };

  return (
    <div className="barscan-card">
      <div className="barscan-header">
        <h3 className="barscan-title">Scan barcode</h3>
        <p className="barscan-subtitle">
          Point the camera at the barcode or QR code on the document. Faster than a photo scan when the code is undamaged.
        </p>
      </div>

      {!scanning && !result && (
        <button type="button" className="barscan-start-btn" onClick={() => { setErrorMsg(''); setScanning(true); }}>
          <i className="bi bi-upc-scan" />
          <span>Start barcode scan</span>
        </button>
      )}

      {scanning && (
        <>
          <div className="barscan-camera-wrap">
            <div className="barscan-camera-guide" />
            <Scanner
              onScan={handleScan}
              onError={(error) => setErrorMsg(error?.message || 'Camera access error.')}
              formats={['pdf417', 'qr_code', 'code_128', 'ean_13', 'data_matrix']}
              styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
            />
          </div>
          <div className="barscan-actions">
            <button type="button" className="barscan-btn-outline" onClick={reset}>
              Cancel
            </button>
          </div>
        </>
      )}

      {errorMsg && (
        <div className="barscan-error">
          <i className="bi bi-exclamation-triangle-fill" />
          <span>{errorMsg}</span>
        </div>
      )}

      {result && (
        <div className="barscan-result">
          <div className={`barscan-result-box ${result.readable ? 'is-readable' : 'is-unreadable'}`}>
            <div className="barscan-result-head">
              <i className={`bi ${result.readable ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
              <span>{result.format} scanned</span>
            </div>
            <div className="barscan-result-value">{result.rawValue}</div>
            {result.readable ? (
              <p className="barscan-result-note">This looks like readable text and has been offered as the licence/ID number.</p>
            ) : (
              <p className="barscan-result-note">
                This barcode's payload isn't plain text. Genuine SA driver's-licence PDF417 barcodes are
                encrypted per the RTMC/eNaTIS spec and can't be decoded in the browser — use the photo
                (OCR) scanner or enter the details manually instead.
              </p>
            )}
          </div>

          {result.idNumberMatch !== null && (
            <div className={`barscan-id-match ${result.idNumberMatch ? 'is-match' : 'is-mismatch'}`}>
              <i className={`bi ${result.idNumberMatch ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
              <span>{result.idNumberMatch ? 'ID number matches the entered value.' : 'ID number does NOT match the entered value — please double-check.'}</span>
            </div>
          )}

          <button type="button" className="barscan-btn-outline" onClick={reset}>
            <i className="bi bi-arrow-counterclockwise me-1" />
            Scan again
          </button>
        </div>
      )}
    </div>
  );
}
