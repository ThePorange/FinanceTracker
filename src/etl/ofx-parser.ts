/**
 * Robust OFX SGML / XML parser for financial statement transaction blocks (<STMTTRN>).
 */
export function parseOfx(fileBuffer: Buffer | string): Record<string, string>[] {
  const content = typeof fileBuffer === 'string' ? fileBuffer : fileBuffer.toString('utf8');
  
  // Isolate transaction blocks between <STMTTRN> and </STMTTRN>
  const stmttrnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>)|(?=<\/CCSTMTTRNRS>)|$)/gi;
  const records: Record<string, string>[] = [];
  
  let match: RegExpExecArray | null;
  while ((match = stmttrnRegex.exec(content)) !== null) {
    const block = match[1];
    if (!block || !block.trim()) continue;

    const row: Record<string, string> = {};
    
    // Tag matching regex supporting SGML unclosed tags: <TAGNAME>VALUE
    const tagRegex = /<([A-Z0-9_\.\-]+)>([^<\r\n]+)/gi;
    let tagMatch: RegExpExecArray | null;
    
    while ((tagMatch = tagRegex.exec(block)) !== null) {
      const tagName = tagMatch[1].trim().toUpperCase();
      let tagVal = tagMatch[2].trim();
      
      // Decode HTML/XML entities
      tagVal = tagVal
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      row[tagName] = tagVal;
    }

    if (Object.keys(row).length > 0) {
      records.push(row);
    }
  }

  return records;
}

/**
 * Extracts distinct STMTTRN field tag names from an OFX file buffer for schema mapping.
 */
export function extractOfxSchemaHeaders(fileBuffer: Buffer | string): string[] {
  const records = parseOfx(fileBuffer);
  const headerSet = new Set<string>();
  
  for (const r of records) {
    for (const key of Object.keys(r)) {
      headerSet.add(key);
    }
  }

  // Fallback default OFX fields if sample is small or empty
  const defaultOfxHeaders = ['TRNTYPE', 'DTPOSTED', 'TRNAMT', 'FITID', 'NAME', 'MEMO', 'CHECKNUM'];
  for (const h of defaultOfxHeaders) {
    headerSet.add(h);
  }

  return Array.from(headerSet);
}
