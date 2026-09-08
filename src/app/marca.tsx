/* La misma A de la web: asta fina y asta gruesa cortadas en horizontal. */
export function Marca({ sub }: { sub?: string }) {
  return (
    <span className="marca">
      <span>
        GO
        <svg viewBox="22 18 56 62" aria-hidden style={{ display: "inline-block", verticalAlign: "baseline" }}>
          <path fill="currentColor" d="M48 18 L52 18 L28 80 L22 80 Z" />
          <path fill="currentColor" d="M46 18 L54 18 L78 80 L66 80 Z" />
        </svg>
        {sub && <small>{sub}</small>}
      </span>
    </span>
  );
}
