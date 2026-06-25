export default function JoinRequestToast({ requests, onApprove, onReject }) {
  if (!requests.length) return null;

  return (
    <div className="join-request-stack">
      {requests.map((req) => (
        <div key={req.userId} className="join-request-toast">
          <p className="join-req-text">
            <strong>{req.username}</strong> wants to join
          </p>
          <div className="join-req-actions">
            <button className="join-req-btn approve" onClick={() => onApprove(req.userId)}>
              Approve
            </button>
            <button className="join-req-btn reject" onClick={() => onReject(req.userId)}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
