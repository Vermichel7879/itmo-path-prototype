export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-medium text-blue-700">ИТМО · Центр карьеры</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Карьерная траектория
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
          Техническая основа проекта подготовлена. Пользовательский интерфейс и
          анкета будут реализованы после согласования следующей фазы.
        </p>
        <p className="mt-8 text-sm text-zinc-500">Статус: PHASE 0 завершена</p>
      </section>
    </main>
  );
}
