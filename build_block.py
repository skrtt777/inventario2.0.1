from pathlib import Path
text = Path('src/pages/TableBrowserLayout.tsx').read_bytes().decode('latin-1')
start = text.index('        <div className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">')
end = text.index('          <footer', start)
old_block = text[start:end]
new_block = "        <div className=\"flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden\">\r\n          <div className={$ {showCards ? '' : 'lg:hidden'} border-b border-slate-200 px-4 py-3}>"\n"""
