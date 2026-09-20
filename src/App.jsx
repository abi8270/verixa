import { useRef, useState } from "react";
import Tesseract from "tesseract.js";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  const [language, setLanguage] = useState("en");

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("verixaHistory");
    return saved ? JSON.parse(saved) : [];
  });

  const fileInputRef = useRef(null);

  // ==========================================
  // TAMIL FALLBACK TRANSLATIONS
  // ==========================================

  const tamilRiskLevel = (level) => {
    if (level === "HIGH RISK") return "அதிக ஆபத்து";
    if (level === "SUSPICIOUS") return "சந்தேகத்திற்குரியது";
    return "பாதுகாப்பானதாக தெரிகிறது";
  };

  const tamilScamTypeFallback = (type) => {
    if (!type) return "தெரியவில்லை";

    const lower = type.toLowerCase();

    if (lower.includes("bank")) return "வங்கி மோசடி";
    if (lower.includes("phishing")) return "Phishing / போலி இணைப்பு மோசடி";
    if (lower.includes("reward")) return "பரிசு மோசடி";
    if (lower.includes("job")) return "வேலைவாய்ப்பு மோசடி";
    if (lower.includes("delivery")) return "Delivery / பார்சல் மோசடி";
    if (lower.includes("investment")) return "முதலீட்டு மோசடி";
    if (lower.includes("impersonation")) return "ஆள் மாறாட்ட மோசடி";
    if (lower.includes("otp")) return "OTP மோசடி";
    if (lower.includes("social")) return "Social Engineering மோசடி";
    if (lower.includes("none")) return "மோசடி அறிகுறிகள் இல்லை";

    return "சந்தேகமான செய்தி";
  };

  // ==========================================
  // GRANDMOTHER MODE
  // ==========================================

  const generateSimpleExplanation = (data, selectedLanguage) => {
    const level = data.riskLevel || "";
    const type = data.scamType || "suspicious message";

    if (selectedLanguage === "ta") {
      if (level === "HIGH RISK") {
        return `இந்த செய்தி ஆபத்தானதாக தெரிகிறது. இது ${
          data.tamilScamType || tamilScamTypeFallback(type)
        } ஆக இருக்கலாம். எந்த link-ஐயும் click செய்ய வேண்டாம். OTP, password, bank details அல்லது பணத்தை யாரிடமும் பகிர வேண்டாம். சந்தேகம் இருந்தால் அந்த நிறுவனத்தின் official website அல்லது phone number மூலம் சரிபார்க்கவும்.`;
      }

      if (level === "SUSPICIOUS") {
        return `இந்த செய்தியில் சில எச்சரிக்கை அறிகுறிகள் உள்ளன. இது ${
          data.tamilScamType || tamilScamTypeFallback(type)
        } ஆக இருக்கலாம். உடனடியாக எந்த link-ஐயும் click செய்யாமல், personal information கொடுக்காமல், official source மூலம் முதலில் சரிபார்க்கவும்.`;
      }

      return `இந்த செய்தியில் பெரிய மோசடி அறிகுறிகள் தெரியவில்லை. இருந்தாலும் password அல்லது OTP போன்ற முக்கிய தகவல்களை பகிர வேண்டாம். எதிர்பாராத request வந்தால் official source மூலம் சரிபார்ப்பது பாதுகாப்பானது.`;
    }

    if (level === "HIGH RISK") {
      return `This message looks dangerous and may be a ${type}. Do not click links, share OTPs, passwords, bank details, or send money. If you are unsure, contact the organization using its official website or phone number.`;
    }

    if (level === "SUSPICIOUS") {
      return `This message has some warning signs and may be a ${type}. Be careful before clicking anything or sharing personal information. Verify the message through an official source first.`;
    }

    return `This message does not show strong scam warning signs based on the available information. Still, avoid sharing passwords or OTPs and verify unexpected requests through official channels.`;
  };

  // ==========================================
  // OCR SCREENSHOT
  // ==========================================

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setOcrLoading(true);
    setMessage("");

    try {
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (info) => {
          console.log(info);
        },
      });

      setMessage(data.text.trim());
    } catch (error) {
      console.error("OCR Error:", error);

      alert(
        language === "ta"
          ? "Screenshot-ஐ படிக்க முடியவில்லை. மீண்டும் முயற்சி செய்யவும்."
          : "Unable to read the screenshot. Please try again."
      );
    } finally {
      setOcrLoading(false);
    }
  };

  // ==========================================
  // AI ANALYSIS
  // ==========================================

  const analyzeMessage = async () => {
    if (!message.trim()) {
      alert(
        language === "ta"
          ? "முதலில் ஒரு message-ஐ உள்ளிடவும் அல்லது screenshot upload செய்யவும்."
          : "Please enter or upload a message first."
      );

      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        "http://localhost:5000/api/analyze",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            message: message,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "AI analysis failed."
        );
      }

      const finalResult = {
        ...data,
        simpleExplanation: generateSimpleExplanation(
          data,
          language
        ),
      };

      setResult(finalResult);

      // Save history
      const historyItem = {
        id: Date.now(),

        message: message,

        riskScore: data.riskScore,

        riskLevel: data.riskLevel,

        scamType: data.scamType,

        tamilScamType:
          data.tamilScamType || "",

        redFlags: data.redFlags || [],

        tamilRedFlags:
          data.tamilRedFlags || [],

        recommendations:
          data.recommendations || [],

        tamilRecommendations:
          data.tamilRecommendations || [],

        simpleExplanation:
          finalResult.simpleExplanation,

        date: new Date().toLocaleString(),
      };

      const updatedHistory = [
        historyItem,
        ...history,
      ];

      setHistory(updatedHistory);

      localStorage.setItem(
        "verixaHistory",
        JSON.stringify(updatedHistory)
      );
    } catch (error) {
      console.error("Analysis Error:", error);

      alert(
        language === "ta"
          ? "⚠️ VERIXA AI-யுடன் connect செய்ய முடியவில்லை. Backend running-ல் இருக்கிறதா என்று பார்க்கவும்."
          : "⚠️ Unable to connect to VERIXA AI. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // HISTORY
  // ==========================================

  const openHistory = (item) => {
    setMessage(item.message);

    setResult({
      success: true,

      riskScore: item.riskScore,

      riskLevel: item.riskLevel,

      scamType: item.scamType,

      tamilScamType:
        item.tamilScamType || "",

      redFlags: item.redFlags || [],

      tamilRedFlags:
        item.tamilRedFlags || [],

      recommendations:
        item.recommendations || [],

      tamilRecommendations:
        item.tamilRecommendations || [],

      simpleExplanation:
        generateSimpleExplanation(
          item,
          language
        ),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const clearHistory = () => {
    const confirmClear = window.confirm(
      language === "ta"
        ? "முழு scan history-ஐ அழிக்க வேண்டுமா?"
        : "Are you sure you want to clear all scan history?"
    );

    if (!confirmClear) return;

    setHistory([]);

    localStorage.removeItem("verixaHistory");
  };

  // ==========================================
  // ANALYZE ANOTHER
  // ==========================================

  const analyzeAnother = () => {
    setMessage("");
    setResult(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ==========================================
  // LANGUAGE CHANGE
  // ==========================================

  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);

    if (result) {
      setResult({
        ...result,

        simpleExplanation:
          generateSimpleExplanation(
            result,
            newLanguage
          ),
      });
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="app">

      {/* ================= NAVBAR ================= */}

      <nav className="navbar">

        <div className="logo">
          <span>VERIXA</span>
          <small>AI</small>
        </div>

        <div className="nav-links">

          <a href="#home">
            {language === "ta"
              ? "முகப்பு"
              : "Home"}
          </a>

          <a href="#how-it-works">
            {language === "ta"
              ? "எப்படி வேலை செய்கிறது"
              : "How It Works"}
          </a>

          <a href="#history">
            {language === "ta"
              ? "History"
              : "History"}
          </a>

          <a href="#about">
            {language === "ta"
              ? "VERIXA பற்றி"
              : "About"}
          </a>

        </div>

      </nav>

      {/* ================= HERO ================= */}

      <section
        className="hero"
        id="home"
      >

        <div className="hero-badge">
          🛡️ AI-Powered Scam Detection
        </div>

        <h1>
          See the <span>risk.</span>
          <br />
          Understand the <span>reason.</span>
        </h1>

        <p className="hero-subtitle">

          {language === "ta"
            ? "சந்தேகமான messages-ஐ VERIXA AI மூலம் பகுப்பாய்வு செய்து, அது மோசடியா என்பதை எளிய மொழியில் புரிந்துகொள்ளுங்கள்."
            : "VERIXA analyzes suspicious messages and explains whether they could be a scam — in simple language."}

        </p>

        <div className="input-card">

          <div className="input-header">

            <h2>
              {language === "ta"
                ? "சந்தேகமான message-ஐ check செய்யவும்"
                : "Check a suspicious message"}
            </h2>

            <span className="secure-badge">
              🔒 Private Analysis
            </span>

          </div>

          {/* LANGUAGE SWITCH */}

          <div className="language-switch">

            <button
              className={
                language === "en"
                  ? "active-language"
                  : ""
              }
              onClick={() =>
                changeLanguage("en")
              }
            >
              🇬🇧 English
            </button>

            <button
              className={
                language === "ta"
                  ? "active-language"
                  : ""
              }
              onClick={() =>
                changeLanguage("ta")
              }
            >
              🇮🇳 தமிழ்
            </button>

          </div>

          {/* MESSAGE INPUT */}

          <textarea
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            placeholder={
              language === "ta"
                ? "சந்தேகமான SMS, WhatsApp message, email, job offer அல்லது bank message-ஐ இங்கே paste செய்யவும்..."
                : "Paste a suspicious SMS, WhatsApp message, email, job offer, bank alert..."
            }
            rows="7"
          />

          {/* BUTTONS */}

          <div className="input-actions">

            <button
              className="upload-btn"
              onClick={() =>
                fileInputRef.current.click()
              }
              disabled={ocrLoading}
            >
              📷{" "}

              {ocrLoading
                ? language === "ta"
                  ? "Screenshot படிக்கிறது..."
                  : "Reading Screenshot..."
                : language === "ta"
                ? "Screenshot Upload"
                : "Upload Screenshot"}

            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{
                display: "none",
              }}
            />

            <button
              className="analyze-btn"
              onClick={analyzeMessage}
              disabled={
                loading || ocrLoading
              }
            >
              {loading
                ? language === "ta"
                  ? "பகுப்பாய்வு செய்கிறது..."
                  : "Analyzing..."
                : language === "ta"
                ? "Message-ஐ Analyze செய்யவும் →"
                : "Analyze Message →"}
            </button>

          </div>

          {ocrLoading && (
            <p className="ocr-status">

              🔍{" "}

              {language === "ta"
                ? "உங்கள் screenshot-லிருந்து text-ஐ VERIXA எடுத்துக்கொண்டு இருக்கிறது..."
                : "VERIXA is extracting text from your screenshot..."}

            </p>
          )}

        </div>

      </section>

      {/* ================= RESULT ================= */}

      {result && (

        <section className="result-section">

          <div className="result-card">

            <div className="result-header">

              <div>

                <span className="section-label">
                  VERIXA ANALYSIS
                </span>

                <h2>
                  {language === "ta"
                    ? "செய்தி அபாய மதிப்பீடு"
                    : "Message Risk Assessment"}
                </h2>

              </div>

              <div className="result-status">

                ✓{" "}

                {language === "ta"
                  ? "பகுப்பாய்வு முடிந்தது"
                  : "Analysis Complete"}

              </div>

            </div>

            {/* SCORE */}

            <div className="score-area">

              <div className="score-circle">

                <strong>
                  {result.riskScore}
                </strong>

                <span>/100</span>

              </div>

              <div className="risk-info">

                <p className="risk-label">

                  {language === "ta"
                    ? "அபாய நிலை"
                    : "RISK LEVEL"}

                </p>

                <h3
                  className={`risk-${result.riskLevel
                    ?.toLowerCase()
                    .replace(" ", "-")}`}
                >

                  {language === "ta"
                    ? tamilRiskLevel(
                        result.riskLevel
                      )
                    : result.riskLevel}

                </h3>

                <p className="scam-type">

                  <strong>

                    {language === "ta"
                      ? "மோசடி வகை:"
                      : "Scam Type:"}

                  </strong>{" "}

                  {language === "ta"
                    ? result.tamilScamType ||
                      tamilScamTypeFallback(
                        result.scamType
                      )
                    : result.scamType}

                </p>

              </div>

            </div>

            {/* ANALYZED MESSAGE */}

            <div className="analysis-message">

              <h3>

                📩{" "}

                {language === "ta"
                  ? "பகுப்பாய்வு செய்யப்பட்ட செய்தி"
                  : "Analyzed Message"}

              </h3>

              <p>{message}</p>

            </div>

            {/* GRANDMOTHER MODE */}

            <div className="simple-explanation">

              <div className="simple-header">

                <div className="simple-icon">
                  🧓
                </div>

                <div>

                  <span className="simple-label">

                    {language === "ta"
                      ? "எளிய விளக்கம்"
                      : "SIMPLE EXPLANATION"}

                  </span>

                  <h3>

                    {language === "ta"
                      ? "பாட்டி மோட்"
                      : "Grandmother Mode"}

                  </h3>

                </div>

              </div>

              <p>
                {generateSimpleExplanation(
                  result,
                  language
                )}
              </p>

            </div>

            {/* RED FLAGS */}

            <div className="red-flags">

              <h3>

                🚩{" "}

                {language === "ta"
                  ? "கண்டறியப்பட்ட எச்சரிக்கைகள்"
                  : "Red Flags Detected"}

              </h3>

              <ul>

                {language === "ta"
                  ? (
                    result.tamilRedFlags?.length
                      ? result.tamilRedFlags
                      : result.redFlags
                  )?.map(
                      (flag, index) => (

                        <li key={index}>

                          <span>!</span>

                          {flag}

                        </li>

                      )
                    )
                  : result.redFlags?.map(
                      (flag, index) => (

                        <li key={index}>

                          <span>!</span>

                          {flag}

                        </li>

                      )
                    )}

              </ul>

            </div>

            {/* RECOMMENDATIONS */}

            <div className="recommendations">

              <h3>

                🛡️{" "}

                {language === "ta"
                  ? "நீங்கள் என்ன செய்ய வேண்டும்"
                  : "What You Should Do"}

              </h3>

              <ul>

                {language === "ta"
                  ? (
                    result.tamilRecommendations
                      ?.length
                      ? result.tamilRecommendations
                      : result.recommendations
                  )?.map(
                      (
                        recommendation,
                        index
                      ) => (

                        <li key={index}>

                          <span>✓</span>

                          {recommendation}

                        </li>

                      )
                    )
                  : result.recommendations?.map(
                      (
                        recommendation,
                        index
                      ) => (

                        <li key={index}>

                          <span>✓</span>

                          {recommendation}

                        </li>

                      )
                    )}

              </ul>

            </div>

            {/* ANALYZE ANOTHER */}

            <button
              className="another-btn"
              onClick={analyzeAnother}
            >

              {language === "ta"
                ? "மற்றொரு message-ஐ Analyze செய்யவும்"
                : "Analyze Another Message"}

            </button>

          </div>

        </section>

      )}

      {/* ================= HISTORY ================= */}

      <section
        className="history-section"
        id="history"
      >

        <div className="history-header">

          <div>

            <span className="section-label">
              YOUR SCANS
            </span>

            <h2>
              {language === "ta"
                ? "Scan History"
                : "Scan History"}
            </h2>

            <p>

              {language === "ta"
                ? "உங்கள் முந்தைய VERIXA analyses இந்த device-ல் சேமிக்கப்படும்."
                : "Your previous VERIXA analyses are stored locally on this device."}

            </p>

          </div>

          {history.length > 0 && (

            <button
              className="clear-history-btn"
              onClick={clearHistory}
            >

              {language === "ta"
                ? "History அழிக்கவும்"
                : "Clear History"}

            </button>

          )}

        </div>

        {history.length === 0 ? (

          <div className="empty-history">

            <div className="empty-icon">
              🕘
            </div>

            <h3>

              {language === "ta"
                ? "இன்னும் scan இல்லை"
                : "No scans yet"}

            </h3>

            <p>

              {language === "ta"
                ? "ஒரு suspicious message-ஐ analyze செய்த பிறகு அது இங்கே தோன்றும்."
                : "Analyze a suspicious message and your results will appear here."}

            </p>

          </div>

        ) : (

          <div className="history-list">

            {history.map((item) => (

              <div
                className="history-item"
                key={item.id}
              >

                <div className="history-main">

                  <div className="history-top">

                    <span
                      className={`history-risk history-${item.riskLevel
                        ?.toLowerCase()
                        .replace(
                          " ",
                          "-"
                        )}`}
                    >

                      {language === "ta"
                        ? tamilRiskLevel(
                            item.riskLevel
                          )
                        : item.riskLevel}

                    </span>

                    <span className="history-date">
                      {item.date}
                    </span>

                  </div>

                  <h3>

                    {language === "ta"
                      ? item.tamilScamType ||
                        tamilScamTypeFallback(
                          item.scamType
                        )
                      : item.scamType}

                  </h3>

                  <p>

                    {item.message.length >
                    120
                      ? item.message.substring(
                          0,
                          120
                        ) + "..."
                      : item.message}

                  </p>

                </div>

                <div className="history-score">

                  <strong>
                    {item.riskScore}
                  </strong>

                  <span>/100</span>

                </div>

                <button
                  className="view-history-btn"
                  onClick={() =>
                    openHistory(item)
                  }
                >

                  {language === "ta"
                    ? "View"
                    : "View"}

                </button>

              </div>

            ))}

          </div>

        )}

      </section>

      {/* ================= HOW IT WORKS ================= */}

      <section
        className="how-section"
        id="how-it-works"
      >

        <div className="section-heading">

          <span className="section-label">
            HOW IT WORKS
          </span>

          <h2>

            {language === "ta"
              ? "சந்தேகமான message-லிருந்து தெளிவான பதில் வரை"
              : "From suspicious message to clear answer"}

          </h2>

        </div>

        <div className="steps">

          <div className="step-card">

            <div className="step-number">
              01
            </div>

            <div className="step-icon">
              📩
            </div>

            <h3>

              {language === "ta"
                ? "Paste அல்லது Upload"
                : "Paste or Upload"}

            </h3>

            <p>

              {language === "ta"
                ? "Suspicious message-ஐ paste செய்யவும் அல்லது screenshot upload செய்யவும்."
                : "Paste a suspicious message or upload a screenshot."}

            </p>

          </div>

          <div className="step-card">

            <div className="step-number">
              02
            </div>

            <div className="step-icon">
              🔍
            </div>

            <h3>

              {language === "ta"
                ? "AI Analysis"
                : "AI Analysis"}

            </h3>

            <p>

              {language === "ta"
                ? "VERIXA AI message-ஐ context மற்றும் suspicious signals மூலம் analyze செய்கிறது."
                : "VERIXA analyzes the message using AI and contextual signals."}

            </p>

          </div>

          <div className="step-card">

            <div className="step-number">
              03
            </div>

            <div className="step-icon">
              🚩
            </div>

            <h3>

              {language === "ta"
                ? "Risk Detection"
                : "Risk Detection"}

            </h3>

            <p>

              {language === "ta"
                ? "மோசடி அறிகுறிகள் மற்றும் suspicious patterns கண்டறியப்படுகின்றன."
                : "Suspicious patterns and scam indicators are identified."}

            </p>

          </div>

          <div className="step-card">

            <div className="step-number">
              04
            </div>

            <div className="step-icon">
              🛡️
            </div>

            <h3>

              {language === "ta"
                ? "Take Action"
                : "Take Action"}

            </h3>

            <p>

              {language === "ta"
                ? "எளிய explanation மற்றும் பாதுகாப்பான next steps கிடைக்கும்."
                : "Get clear explanations and practical safety recommendations."}

            </p>

          </div>

        </div>

      </section>

      {/* ================= ABOUT ================= */}

      <section
        className="about-section"
        id="about"
      >

        <span className="section-label">
          ABOUT VERIXA
        </span>

        <h2>

          {language === "ta"
            ? "யாரும் புரிந்துகொள்ளக்கூடிய Scam Detection"
            : "Scam detection that anyone can understand."}

        </h2>

        <p>

          {language === "ta"
            ? "VERIXA scam detection-ஐ simple, explainable மற்றும் accessible-ஆக மாற்ற உருவாக்கப்பட்டது. Message risky-ஆ என்று மட்டும் சொல்லாமல், ஏன் risky என்று விளக்கி, அடுத்து என்ன செய்ய வேண்டும் என்பதையும் தெரிவிக்கிறது."
            : "VERIXA is designed to make scam detection simple, explainable and accessible. Instead of only saying whether a message is risky, VERIXA explains the warning signs and tells users what they can safely do next."}

        </p>

      </section>

      {/* ================= FOOTER ================= */}

      <footer className="footer">

        <div className="footer-logo">
          VERIXA <span>AI</span>
        </div>

        <p>
          See the risk. Understand the reason.
        </p>

        <span>
          © 2026 VERIXA AI
        </span>

      </footer>

    </div>
  );
}

export default App;