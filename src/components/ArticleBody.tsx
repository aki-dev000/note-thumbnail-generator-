type Props = { text: string };

export default function ArticleBody({ text }: Props) {
  const lines = text.split("\n");

  return (
    <div className="space-y-2 text-gray-700 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-2 first:mt-0">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-base font-semibold text-gray-800 mt-4 mb-1">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        return (
          <p key={i} className="text-sm leading-7">
            {line}
          </p>
        );
      })}
    </div>
  );
}
