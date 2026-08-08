export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="screen start-screen">
      <p className="eyebrow">Интерактивный прототип</p>
      <h1>Собери свой путь в ИТМО</h1>
      <p>Пройди четыре года обучения, выбери карьерную траекторию и посмотри, какие решения могут помочь тебе двигаться к ней.</p>
      <button type="button" onClick={onStart}>Начать</button>
    </section>
  );
}
