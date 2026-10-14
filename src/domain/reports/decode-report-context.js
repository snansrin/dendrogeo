"use strict";

(function (root) {
  function decode(note,today) {
    try {
      const context = typeof note === "string" ? JSON.parse(note) : note;
      if (context?.schema !== "dendrogeo-report-context/1") return null;
      const result = root.DG_VALIDATE_REPORT_CONTEXT.validate(context.study,today);
      if (!result.valid) throw Error("Yayın künyesi geçersiz: " + Object.values(result.errors).join(" "));
      if (context.publication_consent !== true) throw Error("Yayın künyesi için paylaşım onayı eksik.");
      return result.value;
    } catch (error) {
      if (/Yayın künyesi/.test(error.message)) throw error;
      return null;
    }
  }

  root.DG_DECODE_REPORT_CONTEXT = Object.freeze({ decode });
})(globalThis);
