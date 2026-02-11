// src/services/file.parser.js
// Parses uploaded files: .xlsx, .xls, .csv, .json
const XLSX = require('xlsx');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { InvalidFileFormatError } = require('../utils/errors');

class FileParser {
  /**
   * Parse uploaded file and return structured rows
   * @param {string} filePath - path to temp file
   * @param {string} originalName - original file name
   * @returns {{ rows: Array, columns: string[], fileType: string }}
   */
  static async parse(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();

    switch (ext) {
      case '.xlsx':
      case '.xls':
        return FileParser.parseExcel(filePath);
      case '.csv':
        return FileParser.parseCsv(filePath);
      case '.json':
        return FileParser.parseJson(filePath);
      default:
        throw new InvalidFileFormatError(`Unsupported file type: ${ext}. Supported: .xlsx, .xls, .csv, .json`);
    }
  }

  /**
   * Parse Excel file (.xlsx / .xls)
   */
  static parseExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath, { type: 'file', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new InvalidFileFormatError('Excel file has no sheets');

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) throw new InvalidFileFormatError('Excel sheet is empty');

      const columns = Object.keys(rows[0]);
      logger.info({ rows: rows.length, columns: columns.length, sheet: sheetName }, 'Parsed Excel file');

      return { rows, columns, fileType: 'excel' };
    } catch (err) {
      if (err instanceof InvalidFileFormatError) throw err;
      throw new InvalidFileFormatError(`Failed to parse Excel: ${err.message}`);
    }
  }

  /**
   * Parse CSV file
   */
  static parseCsv(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (header) => header.trim(),
      });

      if (result.errors.length > 0) {
        logger.warn({ errors: result.errors.slice(0, 5) }, 'CSV parse warnings');
      }

      if (result.data.length === 0) throw new InvalidFileFormatError('CSV file is empty');

      const columns = result.meta.fields || Object.keys(result.data[0]);
      logger.info({ rows: result.data.length, columns: columns.length }, 'Parsed CSV file');

      return { rows: result.data, columns, fileType: 'csv' };
    } catch (err) {
      if (err instanceof InvalidFileFormatError) throw err;
      throw new InvalidFileFormatError(`Failed to parse CSV: ${err.message}`);
    }
  }

  /**
   * Parse JSON file (array of objects or mapping config)
   */
  static parseJson(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        if (data.length === 0) throw new InvalidFileFormatError('JSON array is empty');
        const columns = Object.keys(data[0]);
        return { rows: data, columns, fileType: 'json' };
      }

      // If it's a mapping config object
      if (data.mappings && Array.isArray(data.mappings)) {
        return { rows: data.mappings, columns: ['apiField', 'tallyXml', 'tallyField', 'required'], fileType: 'json-mapping' };
      }

      throw new InvalidFileFormatError('JSON must be an array of objects or { mappings: [...] }');
    } catch (err) {
      if (err instanceof InvalidFileFormatError) throw err;
      throw new InvalidFileFormatError(`Failed to parse JSON: ${err.message}`);
    }
  }

  /**
   * Validate file magic bytes (basic type check beyond extension)
   */
  static validateFileType(filePath, expectedExt) {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex');

    // ZIP (xlsx)
    if (expectedExt === '.xlsx' && !hex.startsWith('504b0304')) {
      throw new InvalidFileFormatError('File does not appear to be a valid .xlsx file');
    }
    // XLS (legacy OLE2)
    if (expectedExt === '.xls' && !hex.startsWith('d0cf11e0')) {
      throw new InvalidFileFormatError('File does not appear to be a valid .xls file');
    }

    return true;
  }
}

module.exports = FileParser;
