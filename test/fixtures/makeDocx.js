// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Synthetic DOCX (OOXML zip) builder for tests. Assembles a minimal-but-real docx
// package in memory with fflate — no dependency on a real-world fixture file.
import { zipSync, strToU8 } from 'fflate'

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

/**
 * @param {{documentXml:string, footnotesXml?:string, endnotesXml?:string}} parts
 * @returns {Buffer}
 */
export function buildDocxFixture({ documentXml, footnotesXml, endnotesXml }) {
  const files = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELS),
    'word/document.xml': strToU8(documentXml)
  }
  if (footnotesXml) files['word/footnotes.xml'] = strToU8(footnotesXml)
  if (endnotesXml) files['word/endnotes.xml'] = strToU8(endnotesXml)
  return Buffer.from(zipSync(files))
}

const WORD_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"'

/** Wrap raw <w:body> inner XML in a full document.xml envelope. */
export function wrapDocumentXml(bodyInnerXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${WORD_NS}><w:body>${bodyInnerXml}</w:body></w:document>`
}

/** Wrap raw <w:footnote> elements in a full footnotes.xml envelope. */
export function wrapFootnotesXml(footnoteEls) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:footnotes ${WORD_NS}>${footnoteEls}</w:footnotes>`
}
