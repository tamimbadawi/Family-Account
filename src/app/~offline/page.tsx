export default function OfflinePage() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1>No internet right now</h1>
      <p>Keep logging as usual — everything saves when you&apos;re back online.</p>
      <hr style={{ margin: '2rem auto', maxWidth: '300px', opacity: 0.2 }} />
      <div dir="rtl">
        <h2>مفيش إنترنت دلوقتي</h2>
        <p>تقدر تكمّل تسجيل المصاريف عادي، وهتتحفظ أول ما النت يرجع.</p>
      </div>
    </div>
  );
}
