// File System helpers: local dev server direct link + File System Access API + standard download fallback

export async function fetchDefaultExcelFile() {
  try {
    const res = await fetch('/api/excel');
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return {
      handle: null,
      fileName: 'Registru_Gestiune.xlsx',
      buffer,
      isLocalApi: true,
      isNativeHandle: false
    };
  } catch (err) {
    console.warn('Local /api/excel not available:', err);
    return null;
  }
}

export async function openLocalExcelFile() {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Fișiere Excel (.xlsx)',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
            }
          }
        ],
        multiple: false
      });

      const file = await handle.getFile();
      const buffer = await file.arrayBuffer();

      return {
        handle,
        fileName: file.name,
        buffer,
        isLocalApi: false,
        isNativeHandle: true
      };
    } catch (err) {
      if (err.name === 'AbortError') return null;
      console.warn('File picker error:', err);
    }
  }

  // Fallback to standard input file
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return resolve(null);
      const buffer = await file.arrayBuffer();
      resolve({
        handle: null,
        fileName: file.name,
        buffer,
        isLocalApi: false,
        isNativeHandle: false
      });
    };
    input.click();
  });
}

export async function saveExcelFile(workbook, fileState) {
  const buffer = await workbook.xlsx.writeBuffer();

  // 1. If connected via local API endpoint (during local dev / PC testing), write directly to disk!
  if (fileState?.isLocalApi) {
    try {
      const res = await fetch('/api/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer
      });
      if (res.ok) {
        return {
          savedInPlace: true,
          fileName: fileState.fileName,
          methodText: 'Salvat direct în fișierul de pe Desktop'
        };
      }
    } catch (err) {
      console.warn('Failed to save via /api/excel, falling back:', err);
    }
  }

  // 2. If user opened via File System Access API with a writable handle
  if (fileState?.handle && 'createWritable' in fileState.handle) {
    try {
      const writable = await fileState.handle.createWritable();
      await writable.write(buffer);
      await writable.close();
      return {
        savedInPlace: true,
        fileName: fileState.fileName,
        methodText: 'Salvat direct în fișierul original'
      };
    } catch (err) {
      console.warn('Failed in-place write, falling back to download:', err);
    }
  }

  // 3. Fallback to automatic browser download
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileState?.fileName || 'Registru_Gestiune_Actualizat.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    savedInPlace: false,
    fileName: a.download,
    methodText: 'Descărcat automat în folderul Downloads'
  };
}
