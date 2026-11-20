import { useState, useEffect } from "react";

function SearchBar({ query = "", setQuery, setPage }) {
  const [input, setInput] = useState(query);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (input === query) return undefined;

    const delay = setTimeout(() => {
      setQuery(input);
      setPage(1);
    }, 350);

    return () => clearTimeout(delay);
  }, [input, query, setQuery, setPage]);

  const clearInput = () => {
    setInput("");
    setQuery("");
    setPage(1);
  };

  return (
    <div className="flex mb-6">
      <div className="relative w-80">
        <input
          type="text"
          placeholder="Search products..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`
            w-full p-2 pr-10 rounded border outline-none transition
            ${
              isDark
                ? "bg-gray-600 text-white border-gray-500 placeholder-gray-300"
                : "bg-white text-black border-gray-300 placeholder-gray-500"
            }
          `}
        />

        {input && (
          <button
            onClick={clearInput}
            className={`
              absolute right-2 top-1/2 -translate-y-1/2 text-lg
              ${
                isDark
                  ? "text-gray-300 hover:text-white"
                  : "text-gray-500 hover:text-black"
              }
            `}
          >
            ✖
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchBar;