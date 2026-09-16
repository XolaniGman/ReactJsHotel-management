import { useCallback, useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { parseLicenceFields } from '../services/ocr';
import './documentScanner.css';

/**
 * DocumentScanner
 * -----------------------------------------------------------------------
 * Captures a photo of an ID, passport or driver's licence (via webcam or
 * file upload), runs OCR against it, and combines two extraction paths:
 *   - a Machine Readable Zone (MRZ) parser for passports/ID cards, using
 *     the real ICAO 9303 check-digit algorithm when an MRZ is present;
 *   - a South African driver's-licence-style regex parser (licence
 *     number, expiry, date of birth) for documents with no MRZ.
 *
 * IMPORTANT — read before treating this as a real security check:
 * The "authenticity check" shown here is a SIMULATION. It combines one
 * genuinely real signal (MRZ check-digit validation) with randomised
 * heuristic signals that stand in for things real document verification
 * needs, such as hologram/security-feature detection, UV/IR analysis,
 * font & microprint forensics, face match + liveness detection, and
 * checks against government/sanctions databases. None of that is
 * implemented here. For real KYC/identity verification, use a licensed
 * vendor (Onfido, Veriff, Jumio, Persona, etc.) or a backend service —
 * never trust a client-side check alone, since anything running in the
 * browser can be spoofed.
 * -----------------------------------------------------------------------
 */

const STAGES = {
  IDLE: 'idle',
  CAMERA: 'camera',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
};

// ---------------------------------------------------------------------
// MRZ parsing helpers (ICAO 9303)
// ---------------------------------------------------------------------

function mrzCharValue(char) {
  if (char === '<') return 0;
  if (char >= '0' && char <= '9') return char.charCodeAt(0) - 48;
  if (char >= 'A' && char <= 'Z') return char.charCodeAt(0) - 55;
  return 0;
}

function computeCheckDigit(field) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i += 1) {
    sum += mrzCharValue(field[i]) * weights[i % 3];
  }
  return sum % 10;
}

function checkDigitValid(field, expectedDigit) {
  if (expectedDigit === '<' || expectedDigit === undefined) return null;
  return computeCheckDigit(field) === Number(expectedDigit);
}

function cleanMrzLine(line) {
  return line.toUpperCase().replace(/[^A-Z0-9<]/g, '').trim();
}

function formatMrzDate(yyMMdd) {
  if (!yyMMdd || yyMMdd.length !== 6) return null;
  const yy = yyMMdd.slice(0, 2);
  const mm = yyMMdd.slice(2, 4);
  const dd = yyMMdd.slice(4, 6);
  const currentYY = new Date().getFullYear() % 100;
  const century = Number(yy) > currentYY + 10 ? '19' : '20';
  return `${century}${yy}-${mm}-${dd}`;
}

function parseNameField(field) {
  const [surname, given] = field.split('<<');
  return {
    surname: (surname || '').replace(/</g, ' ').trim(),
    givenNames: (given || '').replace(/</g, ' ').trim(),
  };
}

function parseTD3(lines) {
  const [l1, l2] = lines;
  if (!l1 || !l2 || l1.length < 44 || l2.length < 44) return null;
  if (l1[0] !== 'P') return null;

  const docType = l1.slice(0, 2).replace(/</g, '');
  const issuingCountry = l1.slice(2, 5).replace(/</g, '');
  const { surname, givenNames } = parseNameField(l1.slice(5, 44));

  const passportNumber = l2.slice(0, 9).replace(/</g, '');
  const passportNumberCheck = l2[9];
  const nationality = l2.slice(10, 13).replace(/</g, '');
  const dob = l2.slice(13, 19);
  const dobCheck = l2[19];
  const sex = l2[20];
  const expiry = l2.slice(21, 27);
  const expiryCheck = l2[27];
  const personalNumber = l2.slice(28, 42).replace(/</g, '');
  const personalNumberCheck = l2[42];
  const finalCheck = l2[43];

  const compositeField = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43);

  return {
    documentType: 'Passport (TD3)',
    docCode: docType,
    issuingCountry,
    nationality,
    surname,
    givenNames,
    documentNumber: passportNumber,
    dateOfBirth: formatMrzDate(dob),
    sex: sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : 'Unspecified',
    dateOfExpiry: formatMrzDate(expiry),
    personalNumber: personalNumber || null,
    checks: {
      documentNumber: checkDigitValid(l2.slice(0, 9), passportNumberCheck),
      dateOfBirth: checkDigitValid(dob, dobCheck),
      dateOfExpiry: checkDigitValid(expiry, expiryCheck),
      personalNumber: personalNumber ? checkDigitValid(l2.slice(28, 42), personalNumberCheck) : null,
      composite: checkDigitValid(compositeField, finalCheck),
    },
  };
}

function parseTD1(lines) {
  const [l1, l2, l3] = lines;
  if (!l1 || !l2 || !l3 || l1.length < 30 || l2.length < 30 || l3.length < 30) return null;
  if (l1[0] !== 'I' && l1[0] !== 'A' && l1[0] !== 'C') return null;

  const docType = l1.slice(0, 2).replace(/</g, '');
  const issuingCountry = l1.slice(2, 5).replace(/</g, '');
  const documentNumber = l1.slice(5, 14).replace(/</g, '');
  const documentNumberCheck = l1[14];

  const dob = l2.slice(0, 6);
  const dobCheck = l2[6];
  const sex = l2[7];
  const expiry = l2.slice(8, 14);
  const expiryCheck = l2[14];
  const nationality = l2.slice(15, 18).replace(/</g, '');
  const finalCheck = l2[29];

  const { surname, givenNames } = parseNameField(l3);

  const compositeField = l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);

  return {
    documentType: 'ID Card (TD1)',
    docCode: docType,
    issuingCountry,
    nationality,
    surname,
    givenNames,
    documentNumber,
    dateOfBirth: formatMrzDate(dob),
    sex: sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : 'Unspecified',
    dateOfExpiry: formatMrzDate(expiry),
    personalNumber: null,
    checks: {
      documentNumber: checkDigitValid(l1.slice(5, 14), documentNumberCheck),
      dateOfBirth: checkDigitValid(dob, dobCheck),
      dateOfExpiry: checkDigitValid(expiry, expiryCheck),
      personalNumber: null,
      composite: checkDigitValid(compositeField, finalCheck),
    },
  };
}

function extractMrzAndParse(rawText) {
  const candidateLines = rawText
    .split('\n')
    .map(cleanMrzLine)
    .filter((l) => l.length >= 28 && /[A-Z0-9<]{20,}/.test(l));

  if (candidateLines.length >= 2) {
    const last2 = candidateLines.slice(-2);
    const td3 = parseTD3(last2);
    if (td3) return td3;
  }
  if (candidateLines.length >= 3) {
    const last3 = candidateLines.slice(-3);
    const td1 = parseTD1(last3);
    if (td1) return td1;
  }
  return null;
}

// Combines the real MRZ checksum results with simulated forensic signals
// into a single, clearly-labeled demo authenticity score.
function simulateAuthenticityCheck(parsed) {
  if (!parsed) {
    return {
      verdict: 'undetermined',
      score: 0,
      reasons: ['No machine-readable zone (MRZ) could be located and parsed.'],
      realSignal: null,
    };
  }

  const checkEntries = Object.entries(parsed.checks).filter(([, v]) => v !== null);
  const passedChecks = checkEntries.filter(([, v]) => v === true).length;
  const totalChecks = checkEntries.length;
  const mrzScore = totalChecks ? passedChecks / totalChecks : 0;

  const simulatedSignals = [
    { label: 'Font consistency (simulated)', pass: Math.random() > 0.1 },
    { label: 'Document edge / tamper detection (simulated)', pass: Math.random() > 0.1 },
    { label: 'Hologram / security feature presence (simulated)', pass: Math.random() > 0.15 },
  ];
  const simulatedPassed = simulatedSignals.filter((s) => s.pass).length;
  const simulatedScore = simulatedPassed / simulatedSignals.length;

  const overall = Math.round((mrzScore * 0.7 + simulatedScore * 0.3) * 100);

  const reasons = [
    `MRZ check digits: ${passedChecks}/${totalChecks} valid (real ICAO 9303 checksum).`,
    ...simulatedSignals.map((s) => `${s.label}: ${s.pass ? 'pass' : 'flagged'}`),
  ];

  return {
    verdict: overall >= 75 ? 'likely genuine' : overall >= 45 ? 'needs review' : 'likely invalid',
    score: overall,
    reasons,
    realSignal: { passedChecks, totalChecks },
  };
}

const AUTH_TONE = {
  'likely genuine': 'tone-genuine',
  'needs review': 'tone-review',
  'likely invalid': 'tone-invalid',
  undetermined: 'tone-review',
};

// A real, deterministic check (plain string comparison) — not part of the
// simulated authenticity heuristics above. Loose-normalized so formatting
// differences (spaces, dashes, case) don't cause false mismatches.
const normalizeIdNumber = (value) => (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const extractIdNumber = (parsed, licenceFields) =>
  parsed?.documentNumber || licenceFields?.licenseNumber || '';

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

export default function DocumentScanner({ onResult, expectedIdNumber = '' }) {
  const [stage, setStage] = useState(STAGES.IDLE);
  const [imageSrc, setImageSrc] = useState(null);
  const [rawText, setRawText] = useState('');
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState(null);
  const [licenceFields, setLicenceFields] = useState(null);
  const [authResult, setAuthResult] = useState(null);
  const [idMatch, setIdMatch] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showRawText, setShowRawText] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Attach the live stream once the <video> element is actually mounted
  // (i.e. once we're in the CAMERA stage) — doing this in an effect instead
  // of a setTimeout guarantees the DOM node exists and keeps play() tied to
  // React's commit rather than an arbitrary macrotask some browsers treat
  // as no longer "user-initiated".
  useEffect(() => {
    if (stage !== STAGES.CAMERA || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {
      setErrorMsg('The camera preview could not start playing. Try again or upload a photo instead.');
      setStage(STAGES.ERROR);
    });
  }, [stage]);

  const startCamera = async () => {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setStage(STAGES.CAMERA);
    } catch {
      setErrorMsg('Could not access the camera. Check permissions, or upload a photo instead.');
      setStage(STAGES.ERROR);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setImageSrc(dataUrl);
    stopCamera();
    runOcr(dataUrl);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      runOcr(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const runOcr = async (dataUrl) => {
    setStage(STAGES.PROCESSING);
    setProgress(0);
    setErrorMsg('');
    try {
      const { data } = await Tesseract.recognize(dataUrl, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const text = data.text || '';
      setRawText(text);

      const mrzParsed = extractMrzAndParse(text);
      setParsed(mrzParsed);

      const fields = parseLicenceFields(text);
      setLicenceFields(fields);

      const auth = simulateAuthenticityCheck(mrzParsed);
      setAuthResult(auth);

      const extractedId = extractIdNumber(mrzParsed, fields);
      const normalizedExpected = normalizeIdNumber(expectedIdNumber);
      const match = normalizedExpected && extractedId
        ? normalizeIdNumber(extractedId) === normalizedExpected
        : null;
      setIdMatch(match);

      setStage(STAGES.DONE);
      onResult?.({
        rawText: text,
        parsed: mrzParsed,
        licenceFields: fields,
        authenticity: auth,
        confidence: Math.round(data.confidence || 0),
        extractedIdNumber: extractedId || null,
        idNumberMatch: match,
      });
    } catch {
      setErrorMsg('OCR failed to process the image. Try a clearer, well-lit photo.');
      setStage(STAGES.ERROR);
    }
  };

  const reset = () => {
    stopCamera();
    setStage(STAGES.IDLE);
    setImageSrc(null);
    setRawText('');
    setParsed(null);
    setLicenceFields(null);
    setAuthResult(null);
    setIdMatch(null);
    setErrorMsg('');
    setShowRawText(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cardData = (parsed || licenceFields) ? {
    type: parsed?.documentType || 'Driver’s Licence',
    name: parsed ? `${parsed.givenNames} ${parsed.surname}`.trim() : '',
    number: parsed?.documentNumber || licenceFields?.licenseNumber || '',
    dob: parsed?.dateOfBirth || licenceFields?.dob || '',
    expiry: parsed?.dateOfExpiry || licenceFields?.licenseExpiry || '',
    country: parsed?.issuingCountry || parsed?.nationality || '',
  } : null;

  return (
    <div className="docscan-card">
      <div className="docscan-header">
        <h3 className="docscan-title">Scan licence, ID or passport</h3>
        <p className="docscan-subtitle">
          Capture or upload a photo. We'll read what we can and flag anything that needs front-desk review.
        </p>
      </div>

      {stage === STAGES.IDLE && (
        <div className="docscan-choice-grid">
          <button type="button" className="docscan-choice-btn" onClick={startCamera}>
            <i className="bi bi-camera" />
            <span>Use camera</span>
          </button>
          <button type="button" className="docscan-choice-btn" onClick={() => fileInputRef.current?.click()}>
            <i className="bi bi-cloud-upload" />
            <span>Upload photo</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="docscan-hidden"
            onChange={handleFileUpload}
          />
        </div>
      )}

      {stage === STAGES.CAMERA && (
        <div className="docscan-stack">
          <div className="docscan-camera-wrap">
            <video ref={videoRef} muted playsInline />
            <div className="docscan-camera-guide" />
          </div>
          <div className="docscan-actions">
            <button type="button" className="docscan-btn-primary" onClick={capturePhoto}>
              Capture
            </button>
            <button type="button" className="docscan-btn-outline" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage === STAGES.PROCESSING && (
        <div className="docscan-processing">
          {imageSrc && <img src={imageSrc} alt="Captured document" className="docscan-preview-img" />}
          <i className="bi bi-arrow-repeat docscan-spin" />
          <p className="docscan-note">Reading document… {progress}%</p>
        </div>
      )}

      {stage === STAGES.ERROR && (
        <div className="docscan-error">
          <i className="bi bi-x-circle-fill" />
          <p className="docscan-note">{errorMsg}</p>
          <button type="button" className="docscan-btn-outline" onClick={reset}>
            Try again
          </button>
        </div>
      )}

      {stage === STAGES.DONE && (
        <div className="docscan-stack">
          {cardData ? (
            <div className="docscan-vcard">
              <span className="docscan-vcard-badge">Scanned copy</span>
              <div className="docscan-vcard-top">
                {imageSrc && <img src={imageSrc} alt="" className="docscan-vcard-photo" />}
                <div className="docscan-vcard-heading">
                  <span className="docscan-vcard-type">{cardData.type}</span>
                  <span className="docscan-vcard-name">{cardData.name || '—'}</span>
                  {cardData.country && <span className="docscan-vcard-country">{cardData.country}</span>}
                </div>
              </div>
              <div className="docscan-vcard-rows">
                <div className="docscan-vcard-row">
                  <span>No.</span>
                  <strong>{cardData.number || '—'}</strong>
                </div>
                <div className="docscan-vcard-row">
                  <span>DOB</span>
                  <strong>{cardData.dob || '—'}</strong>
                </div>
                <div className="docscan-vcard-row">
                  <span>Expiry</span>
                  <strong>{cardData.expiry || '—'}</strong>
                </div>
              </div>
              <p className="docscan-vcard-footer">Digital copy for verification only — not a valid identification document.</p>
            </div>
          ) : (
            imageSrc && <img src={imageSrc} alt="Scanned document" className="docscan-preview-img" />
          )}

          {parsed ? (
            <div className="docscan-fields">
              <Field label="Document type" value={parsed.documentType} />
              <Field label="Name" value={`${parsed.givenNames} ${parsed.surname}`.trim()} />
              <Field label="Document number" value={parsed.documentNumber} />
              <Field label="Nationality" value={parsed.nationality} />
              <Field label="Date of birth" value={parsed.dateOfBirth} />
              <Field label="Sex" value={parsed.sex} />
              <Field label="Date of expiry" value={parsed.dateOfExpiry} />
            </div>
          ) : licenceFields && (licenceFields.licenseNumber || licenceFields.licenseExpiry || licenceFields.dob) ? (
            <div className="docscan-fields">
              <Field label="Licence / ID number" value={licenceFields.licenseNumber} />
              <Field label="Licence expiry" value={licenceFields.licenseExpiry} />
              <Field label="Date of birth" value={licenceFields.dob} />
            </div>
          ) : (
            <div className="docscan-warn-box">
              <i className="bi bi-info-circle me-1" />
              Couldn't confidently read the document fields. Raw OCR text is available below — try a
              sharper, more evenly lit photo, or enter the details manually.
            </div>
          )}

          {idMatch !== null && (
            <div className={`docscan-id-match ${idMatch ? 'is-match' : 'is-mismatch'}`}>
              <i className={`bi ${idMatch ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
              <span>{idMatch ? 'ID number matches the entered value.' : 'ID number does NOT match the entered value — please double-check.'}</span>
            </div>
          )}

          {authResult && parsed && (
            <div className={`docscan-auth ${AUTH_TONE[authResult.verdict] || 'tone-review'}`}>
              <div className="docscan-auth-head">
                <i className={`bi ${authResult.verdict === 'likely genuine' ? 'bi-shield-check' : 'bi-shield-exclamation'}`} />
                <span>{authResult.verdict} · {authResult.score}/100</span>
              </div>
              <ul className="docscan-auth-reasons">
                {authResult.reasons.map((r) => (
                  <li key={r}><span>•</span><span>{r}</span></li>
                ))}
              </ul>
              <p className="docscan-auth-disclaimer">
                Simulated result for demo purposes. Only the MRZ checksum portion is a real
                verification (ICAO 9303). Use a licensed identity-verification vendor before
                trusting this for real decisions.
              </p>
            </div>
          )}

          <button type="button" className="docscan-raw-toggle" onClick={() => setShowRawText((s) => !s)}>
            {showRawText ? 'Hide raw OCR text' : 'Show raw OCR text'}
          </button>
          {showRawText && <pre className="docscan-raw-pre">{rawText}</pre>}

          <button type="button" className="docscan-rescan-btn" onClick={reset}>
            <i className="bi bi-arrow-counterclockwise" />
            Scan another document
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="docscan-hidden" />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="docscan-field-row">
      <span className="docscan-field-label">{label}</span>
      <span className="docscan-field-value">{value || '—'}</span>
    </div>
  );
}
