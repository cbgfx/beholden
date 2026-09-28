/** The 6-dot grip icon used inside every drag handle in the app (note/item
 * reordering, character-sheet panel drag). Was copy-pasted independently
 * into each drag-and-drop implementation; this is the one copy. Callers own
 * the surrounding handle button (size, border, pointer handlers) since that
 * varies by context -- only the icon itself was ever actually identical. */
export function DragHandleGrip(props: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 3px)",
        gridAutoRows: "3px",
        gap: 2,
        opacity: 0.85,
      }}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <span
          key={index}
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: props.color,
            display: "block",
          }}
        />
      ))}
    </span>
  );
}
