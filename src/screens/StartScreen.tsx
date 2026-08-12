export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="screen start-screen">
      <p className="eyebrow">Интерактивный прототип</p>
      <h1>Собери свой путь в ИТМО</h1>
      <p>Выбери карьерную цель, узнай, что будешь изучать, и посмотри, как дисциплины, практика и Центр карьеры могут быть связаны с твоими интересами.</p>
      <button type="button" onClick={onStart}>Начать</button>
    </section>
  );
}
