export const metadata = { title: "Privacy Policy — Brand MD Publisher" };

export default function Privacy() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 20px", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>
      <h1>Privacy Policy — Brand MD Publisher</h1>
      <p>Last updated: 18 November 2026</p>
      <p>Brand MD Publisher is an internal tool of Brand MD Solutions (Tirur, Kerala, India). It is used only by our own staff
        to publish videos that our team produced and a doctor approved, to social media channels we manage for Doctor Uncle Family Clinic.</p>
      <h2>What the tool accesses</h2>
      <ul>
        <li><b>Google Drive (read-only):</b> to download the approved video file whose link our editor added in our console.</li>
        <li><b>YouTube:</b> to upload that video to our own channel and add a first comment.</li>
        <li><b>Facebook Page and Instagram account:</b> to publish the same video and a first comment.</li>
      </ul>
      <h2>What we store</h2>
      <p>Only the published post links and IDs, captions and status are stored in our private console database. Videos are
        deleted from the office computer after publishing. Access tokens stay on that computer and are never shared or sold.
        We do not collect data about viewers or commenters through this tool.</p>
      <h2>Your choices</h2>
      <p>You can revoke the tool's access at any time from your Google Account (Security → Third-party access) or from
        Meta Business Settings.</p>
      <h2>Contact</h2>
      <p>manzoornel@gmail.com</p>
    </main>
  );
}
