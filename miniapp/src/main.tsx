// Минимальный каркас Mini App: инициализация SDK + заглушка каталога уроков.
import React from "react";
import { createRoot } from "react-dom/client";
import { init, backButton, viewport } from "@telegram-apps/sdk";

init();
viewport.expand();

// Бэкенд (тот же VPS)
const BACKEND = "http://localhost:8000";

async function loadLessons() {
  const initData = (window as any).Telegram?.WebApp?.initData ?? "";
  const r = await fetch(`${BACKEND}/api/lessons?user_id=DEMO&course_id=dj-basics`, {
    headers: { "X-Telegram-Init-Data": initData },
  });
  return r.json();
}

function App() {
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => { loadLessons().then(setData); }, []);
  return (
    <div style={{ fontFamily: "sans-serif", padding: 16 }}>
      <h2>🎚 Школа DJing</h2>
      {!data && <p>Загрузка…</p>}
      {data?.paid === false && <p>Курс закрыт. Оплати в боте, чтобы открыть уроки.</p>}
      {data?.paid && (
        <ul>
          {data.lessons.map((l: any) => (
            <li key={l.id}>{l.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
