function Pagination({ page, setPage, totalPages = 1 }) {
  const isFirstPage = page <= 1;
  const isLastPage = totalPages > 0 ? page >= totalPages : true;

  return (
    <div className="flex justify-center items-center gap-4 mt-6">
      <button
        onClick={() => setPage(page - 1)}
        disabled={isFirstPage}
        className={`
          px-4 py-2 rounded
          ${
            isFirstPage
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-500"
          }
        `}
      >
        Prev
      </button>

      <span className="font-semibold text-lg dark:text-white">
        Page {page} of {Math.max(1, totalPages)}
      </span>

      <button
        onClick={() => setPage(page + 1)}
        disabled={isLastPage}
        className={`
          px-4 py-2 rounded
          ${
            isLastPage
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-500"
          }
        `}
      >
        Next
      </button>
    </div>
  );
}

export default Pagination;