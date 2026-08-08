import type { CareerCenterResource } from "../types/program";

export function CareerCenterResources({ resources }: { resources: CareerCenterResource[] }) {
  if (!resources.length) return null;
  return (
    <aside className="resource-box">
      <h3>Центр карьеры ИТМО</h3>
      <ul>
        {resources.map((resource) => (
          <li key={resource.resource_id}>
            <span>{resource.title}</span>{" "}
            {resource.direct_url ? <a href={resource.direct_url} target="_blank" rel="noreferrer">Открыть ресурс</a> : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
