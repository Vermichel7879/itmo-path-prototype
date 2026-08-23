import Link from "next/link";
import { SiteHeader } from "@/components/ui/site-header";

function TrajectoryMotif() {
  return (
    <div className="landing-motif" aria-hidden="true">
      <svg viewBox="0 0 520 460" fill="none" className="h-full w-full">
        <path
          d="M82 382C154 382 133 294 210 294C287 294 257 200 342 200C422 200 392 92 458 74"
          stroke="url(#line)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M82 382C154 382 133 294 210 294C287 294 257 200 342 200C422 200 392 92 458 74"
          stroke="#0B68FF"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray="1 58"
        />
        <circle cx="82" cy="382" r="17" fill="#0B68FF" />
        <circle cx="210" cy="294" r="14" fill="white" stroke="#0B68FF" strokeWidth="5" />
        <circle cx="342" cy="200" r="14" fill="white" stroke="#0B68FF" strokeWidth="5" />
        <circle cx="458" cy="74" r="22" fill="#DDEBFF" stroke="#0B68FF" strokeWidth="5" />
        <defs>
          <linearGradient id="line" x1="82" y1="382" x2="458" y2="74" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0B68FF" />
            <stop offset="1" stopColor="#72A8FF" />
          </linearGradient>
        </defs>
      </svg>
      <div className="landing-motif__label landing-motif__label--start">Сейчас</div>
      <div className="landing-motif__label landing-motif__label--finish">Следующий шаг</div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SiteHeader />
      <main>
        <section className="mx-auto grid min-h-[670px] w-full max-w-[1200px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="page-enter max-w-[660px]">
            <p className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
              <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
              Стартовая точка для следующего карьерного шага
            </p>
            <h1 className="text-[2.8rem] font-semibold leading-[0.98] tracking-[-0.055em] text-zinc-950 sm:text-[4.5rem] lg:text-[5rem]">
              Построй свою карьерную траекторию
            </h1>
            <p className="mt-7 max-w-[610px] text-lg leading-8 text-zinc-600 sm:text-xl">
              Ответь на несколько вопросов о своей ситуации, получи главный карьерный фокус,
              ближайшие действия и подходящие возможности ИТМО.
            </p>
            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href="/questionnaire" className="button-primary button-primary--large">
                Построить траекторию <span aria-hidden="true">→</span>
              </Link>
              <p className="text-sm font-medium text-zinc-500">≈ 3 минуты · 8 основных вопросов</p>
            </div>
          </div>
          <TrajectoryMotif />
        </section>

        <section className="border-t border-black/8 bg-white">
          <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-3 md:py-12">
            {[
              ["01", "Ответь", "Коротко опиши текущую ситуацию, сложности и ближайшую цель."],
              ["02", "Определи фокус", "Увидь одно главное направление без процентов и скрытых оценок."],
              ["03", "Начни действовать", "Получишь три шага и контрольную точку на ближайшие 2–4 недели."],
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-4">
                <span className="text-sm font-bold text-blue-700">{number}</span>
                <div>
                  <h2 className="font-semibold text-zinc-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
