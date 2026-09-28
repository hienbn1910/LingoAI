import mongoose from "mongoose";
import TranslationHistory from "../models/TranslationHistory.js";

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

// Chỉ tạo cập nhật cho các trường chỉnh sửa; không ghi đè bản AI ban đầu.
export function buildEditUpdate(item, input, restore = false) {
  const blocks = item.documentBlocks || [];
  if (restore) {
    return {
      editedText: null,
      editedAt: null,
      ...(blocks.length && {
        documentBlocks: blocks.map((block) => ({ ...block, editedText: null })),
      }),
    };
  }

  let editedText;
  let documentBlocks;
  if (blocks.length) {
    if (!Array.isArray(input.blocks) || input.blocks.length !== blocks.length) {
      throw badRequest("Vui lòng giữ đủ các đoạn của tài liệu.");
    }
    const edits = new Map();
    for (const block of input.blocks) {
      if (
        !block ||
        typeof block.id !== "string" ||
        edits.has(block.id) ||
        typeof block.editedText !== "string"
      ) {
        throw badRequest("Dữ liệu các đoạn không hợp lệ.");
      }
      edits.set(block.id, block.editedText);
    }
    documentBlocks = blocks.map((block) => {
      if (!edits.has(block.id))
        throw badRequest("Mã đoạn tài liệu không khớp.");
      return { ...block, editedText: edits.get(block.id) };
    });
    editedText = documentBlocks.map((block) => block.editedText).join("\n\n");
  } else {
    if (typeof input.editedText !== "string") {
      throw badRequest("Nội dung chỉnh sửa phải là văn bản.");
    }
    editedText = input.editedText;
  }
  if (!editedText.trim())
    throw badRequest("Bản dịch không được để trống hoàn toàn.");
  if (editedText.length > 200_000)
    throw badRequest("Bản dịch vượt quá 200.000 ký tự.");
  return {
    editedText,
    editedAt: new Date(),
    ...(documentBlocks && { documentBlocks }),
  };
}

async function updateHistory(req, res, restore) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "ID lịch sử không hợp lệ." });
    }
    const revision = req.body?.revision;
    if (!Number.isSafeInteger(revision) || revision < 0) {
      throw badRequest("Thiếu phiên bản bản dịch. Hãy tải lại lịch sử.");
    }
    const item = await TranslationHistory.findById(req.params.id).lean();
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bản dịch." });
    const changes = buildEditUpdate(item, req.body, restore);
    // Một tab khác đã sửa thì không ghi đè âm thầm lên thay đổi đó.
    const versionFilter =
      revision === 0
        ? { $or: [{ __v: 0 }, { __v: { $exists: false } }] }
        : { __v: revision };
    const updated = await TranslationHistory.findOneAndUpdate(
      { _id: item._id, ...versionFilter },
      { $set: changes, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
    if (!updated) {
      return res
        .status(409)
        .json({
          success: false,
          message:
            "Bản dịch đã thay đổi hoặc bị xóa ở nơi khác. Hãy sao chép phần đang sửa rồi tải lại trang.",
        });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({
        success: false,
        message:
          error.status === 400
            ? error.message
            : "Không thể lưu thay đổi. Vui lòng thử lại.",
      });
  }
}

export const saveHistoryEdit = (req, res) => updateHistory(req, res, false);
export const restoreHistoryTranslation = (req, res) =>
  updateHistory(req, res, true);
