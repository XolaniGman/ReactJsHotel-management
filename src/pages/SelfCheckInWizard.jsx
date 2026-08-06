import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useFaceDetection } from 'react-use-face-detection';
import { useAuth } from '../context/AuthContext';
import { listBookingsByEmail } from '../services/reservationService';
import { allocateRoomForBooking } from '../services/checkinService';
import { todayISO, formatGuestDate } from '../lib/utils';
import './guest.css';

const STAGES = ['Verify booking', 'Your identity', 'Room allocation', 'Welcome'];

const CAPTURE_DELAY_MS = 800;

function FaceScanCamera({ onCaptured, onAllocate }) {
  const [localError, setLocalError] = useState('');
  const [captured, setCaptured] = useState(false);
  const capturedRef = useRef(false);
  const timerRef = useRef(null);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;
  const onAllocateRef = useRef(onAllocate);
  onAllocateRef.current = onAllocate;

  const { webcamRef, boundingBox, isLoading, detected, facesDetected } = useFaceDetection({
    faceDetectionOptions: { model: 'short', minDetectionConfidence: 0.7 },
    faceDetection: new window.FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/${file}`,
    }),
    camera: ({ mediaSrc, onFrame, width, height }) =>
      new window.Camera(mediaSrc, { onFrame, width, height }),
    mirrored: true,
  });

  const doCapture = useCallback(() => {
    if (capturedRef.current) return;
    const shot = webcamRef.current && webcamRef.current.getScreenshot();
    if (!shot) return false;
    capturedRef.current = true;
    setCaptured(true);
    onCapturedRef.current(shot);
    return true;
  }, [webcamRef]);

  useEffect(() => {
    if (capturedRef.current || isLoading || !detected) return undefined;
    timerRef.current = setTimeout(() => {
      if (!doCapture()) {
        setLocalError('Could not capture your face. Please try again.');
      }
    }, CAPTURE_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [detected, isLoading, doCapture]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const capture = () => {
    setLocalError('');
    if (capturedRef.current) return;
    if (!detected) return setLocalError('No face detected. Please position your face inside the camera frame.');
    if (!doCapture()) setLocalError('Could not capture your face. Please try again.');
  };

  return (
    <div className="face-scan">
      <div className="face-scan-head">
        <span className="clean-label mb-0">Face verification</span>
        <span className={`face-scan-status${captured ? ' ok' : detected ? ' ok' : ''}`}>
          {isLoading ? (
            <><span className="spinner-border spinner-border-sm me-2" /> Loading face detector…</>
          ) : captured ? (
            <><i className="bi bi-check-circle me-2" /> Face captured</>
          ) : detected ? (
            <><i className="bi bi-check-circle me-2" /> Face detected{facesDetected > 1 ? ` (${facesDetected} faces)` : ''} — capturing…</>
          ) : (
            <><i className="bi bi-person me-2" /> No face detected</>
          )}
        </span>
      </div>
      <div className="face-scan-frame">
        {isLoading && (
          <div className="face-scan-loading"><span className="spinner-border text-light" /></div>
        )}
        <Webcam
          ref={webcamRef}
          audio={false}
          mirrored
          className="face-scan-video"
          screenshotFormat="image/jpeg"
          screenshotQuality={0.7}
        />
        {boundingBox.map(
          (box, index) =>
            box.xCenter && box.yCenter && box.width && box.height && (
              <div
                key={`face-${index}`}
                className="face-scan-box"
                style={{
                  top: `${box.yCenter * 100}%`,
                  left: `${box.xCenter * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                }}
              />
            ),
        )}
        {captured && <div className="face-scan-loading"><i className="bi bi-check-circle-fill text-success" style={{ fontSize: '2.6rem' }} /></div>}
      </div>
      <p className="text-muted small mt-2 mb-0">
        {captured
          ? 'Photo captured. Review your details above, then click Continue to finish check-in.'
          : 'Position your face inside the frame — a photo is captured automatically once your face is detected.'}
      </p>
      {localError && <div className="lost-alert lost-alert-danger mt-2"><i className="bi bi-exclamation-triangle me-2" />{localError}</div>}
      <button type="button" className="book-submit mt-3" style={{ width: 'auto', paddingInline: '2rem' }} onClick={captured ? () => onAllocateRef.current() : capture}>
        {captured ? (
          <><i className="bi bi-arrow-right me-2" /> Continue</>
        ) : (
          <><i className="bi bi-camera me-2" /> Capture face &amp; continue</>
        )}
      </button>
    </div>
  );
}

function FaceScanStep({ onCaptured, onAllocate }) {
  if (!window.FaceDetection || !window.Camera) {
    return (
      <div className="lost-alert lost-alert-danger">
        <i className="bi bi-exclamation-triangle me-2" />
        Face verification could not load. Please refresh the page and try again.
      </div>
    );
  }
  return <FaceScanCamera onCaptured={onCaptured} onAllocate={onAllocate} />;
}

export default function SelfCheckInWizard() {
  const { user } = useAuth();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState('');

  const [email, setEmail] = useState(user?.email || '');
  const [firstName, setFirstName] = useState('');
  const [reservation, setReservation] = useState(null);

  const [idDocType, setIdDocType] = useState('ID');
  const [idNumber, setIdNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [faceImage, setFaceImage] = useState(null);
  const [result, setResult] = useState(null);

  const verify = async () => {
    setError('');
    if (!email.trim()) return setError('Please enter the email used to make your booking.');
    if (!firstName.trim()) return setError('Please enter your first name.');

    let bookings;
    try {
      bookings = await listBookingsByEmail(email);
    } catch {
      return setError('Could not look up your bookings. Please try again.');
    }

    const first = firstName.trim().toLowerCase();
    const matches = bookings.filter((b) =>
      (b.guestName || '').trim().split(' ')[0].toLowerCase() === first,
    );
    if (matches.length === 0) return setError('No booking found for this email and name.');

    const today = todayISO();
    const ready = matches.find(
      (b) =>
        b.status === 'Approved' &&
        (!b.checkInDate || today >= b.checkInDate) &&
        (!b.checkOutDate || today < b.checkOutDate),
    );

    if (!ready) {
      const approved = matches.find((b) => b.status === 'Approved');
      if (approved) {
        if (approved.checkInDate && today < approved.checkInDate) {
          return setError(`Your booking is not due for check-in until ${formatGuestDate(approved.checkInDate)}. Please return on your check-in date.`);
        }
        if (approved.checkOutDate && today >= approved.checkOutDate) {
          return setError('Your booking stay has ended. Please contact reception if you need assistance.');
        }
      }
      return setError('No approved booking is ready for check-in at this time.');
    }

    if (ready.guestEmail && user?.email && ready.guestEmail.toLowerCase() !== user.email.trim().toLowerCase()) {
      return setError('This booking was made with a different email. Please sign in with the email used to make the booking.');
    }

    setReservation(ready);
    setStage(1);
  };

  const allocate = async (faceShot) => {
    setError('');
    if (!idNumber.trim()) {
      setError('Please enter your ID / passport number.');
      return false;
    }
    if (!dateOfBirth) {
      setError('Please enter your date of birth.');
      return false;
    }
    let res;
    try {
      res = await allocateRoomForBooking(reservation, 'self', {
        idDocType,
        idNumber,
        dateOfBirth,
        faceImage: faceShot,
      });
    } catch {
      setError('Something went wrong while checking you in. Please try again.');
      return false;
    }
    if (res?.error) {
      setError(res.error);
      return false;
    }
    setResult(res);
    setStage(3);
    return true;
  };

  const handleCaptured = (shot) => {
    setFaceImage(shot);
  };

  const handleAllocate = () => allocate(faceImage);

  const progress = ((stage + 1) / 4) * 100;

  if (result) {
    return (
      <div className="res-shell">
        <div className="dash-notice dash-notice--green" style={{ textAlign: 'center', padding: '2rem' }}>
          <i className="bi bi-check-circle" style={{ fontSize: '2.5rem' }} />
          <h2 style={{ fontFamily: "'Noto Serif', serif", margin: '0.75rem 0' }}>Welcome, {reservation.guestName}!</h2>
          <p className="mb-1">Your room is ready. Here are your details:</p>
          {faceImage && (
            <div className="face-scan-thumb mx-auto mb-3">
              <img src={faceImage} alt="Verified guest" />
            </div>
          )}
          <div className="d-inline-block text-start mt-2" style={{ textAlign: 'left' }}>
            <p><strong>Room:</strong> {result.room.number}</p>
            <p><strong>Wi-Fi:</strong> {result.room.wifi ?? `GrandHotel-${result.room.number}`}</p>
            <p><strong>Password:</strong> guest2026</p>
            <p><strong>Mobile key:</strong> Enabled via NFC</p>
          </div>
          <Link to="/CheckIns/CheckInWelcome" className="res-btn res-btn-success mt-2">Continue</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Self Check-In</div>
          <h1 className="lost-title">Check in online</h1>
          <p className="lost-copy">
            Complete the steps below to check in without visiting the front desk. You&rsquo;ll get
            your room number, Wi-Fi access and mobile key.
          </p>
        </div>
        <Link to="/Guest/Dashboard" className="res-btn res-btn-outline"><i className="bi bi-arrow-left me-2" /> Back</Link>
      </div>

      <div className="mb-4">
        <div className="d-flex justify-content-between text-muted small mb-1">
          {STAGES.map((s, i) => (
            <span key={s} className={i <= stage ? 'fw-bold text-success' : ''}>{i + 1}. {s}</span>
          ))}
        </div>
        <div className="progress" style={{ height: 8 }}>
          <div className="progress-bar bg-success" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

      <div className="clean-form">
        {stage === 0 && (
          <>
            <h2 className="clean-card-title">Verify your booking</h2>
            <p className="text-muted small">Enter the email and first name you used when making your booking.</p>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="clean-label" htmlFor="Email">Email</label>
                <input id="Email" type="email" className="form-control clean-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="clean-label" htmlFor="FirstName">First name</label>
                <input id="FirstName" className="form-control clean-input" placeholder="e.g. Thando" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
            </div>
            <button type="button" className="book-submit mt-4" onClick={verify}><i className="bi bi-search me-2" /> Verify booking</button>
          </>
        )}

        {stage === 1 && (
          <>
            <h2 className="clean-card-title">Confirm your identity</h2>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="clean-label" htmlFor="DocType">ID document</label>
                <select id="DocType" className="form-select clean-input" value={idDocType} onChange={(e) => setIdDocType(e.target.value)}>
                  <option>ID</option><option>Passport</option><option>Driver&apos;s licence</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="clean-label" htmlFor="IdNumber">ID / Passport number</label>
                <input id="IdNumber" className="form-control clean-input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="clean-label" htmlFor="Dob">Date of birth</label>
                <input id="Dob" type="date" className="form-control clean-input" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
            </div>
            <hr className="my-4" style={{ borderColor: '#e5ded0' }} />
            <FaceScanStep onCaptured={handleCaptured} onAllocate={handleAllocate} />
            <div className="mt-3">
              <button type="button" className="book-cancel" onClick={() => setStage(0)}><i className="bi bi-arrow-left me-2" /> Back</button>
            </div>
          </>
        )}

        {stage === 2 && (
          <>
            <h2 className="clean-card-title">Allocating your room…</h2>
            <p className="text-muted">We&rsquo;re preparing the best available room for you.</p>
          </>
        )}

        {stage === 3 && (
          <>
            <h2 className="clean-card-title">Welcome</h2>
            <p className="text-muted">Your room has been allocated.</p>
          </>
        )}
      </div>
    </div>
  );
}
