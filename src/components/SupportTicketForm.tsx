import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileImage, ImagePlus, LoaderCircle, Paperclip, Trash2, UploadCloud } from "lucide-react";
import {
  createSupportTicket,
  getCurrentSupportHwid,
  SUPPORT_MAX_IMAGES,
  SUPPORT_MAX_IMAGE_BYTES,
  validateProofImage,
} from "../lib/supportApi";
import type { LicenseType } from "../lib/licenseApi";
import StatusPill from "./StatusPill";

type SupportTicketFormProps = {
  mode?: "panel" | "modal";
  licenseType: LicenseType;
  prioritySupport?: boolean;
};

type ProofPreview = {
  id: string;
  file: File;
  previewUrl: string;
};

export default function SupportTicketForm({
  mode = "panel",
  licenseType,
  prioritySupport = false,
}: SupportTicketFormProps) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [proofs, setProofs] = useState<ProofPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hwid, setHwid] = useState("Loading HWID...");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const proofUrlsRef = useRef<string[]>([]);

  const totalBytes = useMemo(() => proofs.reduce((sum, proof) => sum + proof.file.size, 0), [proofs]);

  useEffect(() => {
    let isMounted = true;

    getCurrentSupportHwid()
      .then((value) => {
        if (isMounted) {
          setHwid(value);
        }
      })
      .catch(() => {
        if (isMounted) {
          setHwid("HWID unavailable");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    proofUrlsRef.current = proofs.map((proof) => proof.previewUrl);
  }, [proofs]);

  useEffect(() => {
    return () => {
      proofUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function addFiles(files: FileList | File[]) {
    setError("");
    setMessage("");

    const nextFiles = Array.from(files);
    if (!nextFiles.length) {
      return;
    }

    setProofs((current) => {
      const availableSlots = SUPPORT_MAX_IMAGES - current.length;
      if (availableSlots <= 0) {
        setError(`Attach up to ${SUPPORT_MAX_IMAGES} proof images.`);
        return current;
      }

      const accepted: ProofPreview[] = [];

      for (const file of nextFiles.slice(0, availableSlots)) {
        const validationError = validateProofImage(file);
        if (validationError) {
          setError(validationError);
          continue;
        }

        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (nextFiles.length > availableSlots) {
        setError(`Attach up to ${SUPPORT_MAX_IMAGES} proof images.`);
      }

      return [...current, ...accepted];
    });

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function removeProof(id: string) {
    setProofs((current) => {
      const removed = current.find((proof) => proof.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((proof) => proof.id !== id);
    });
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addFiles(event.target.files);
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!subject.trim() || !description.trim()) {
      setError("Enter a subject and description before submitting.");
      return;
    }

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await createSupportTicket({
        subject: subject.trim(),
        description: description.trim(),
        licenseType,
        proofImages: proofs.map((proof) => proof.file),
      });

      setSubject("");
      setDescription("");
      proofs.forEach((proof) => URL.revokeObjectURL(proof.previewUrl));
      setProofs([]);
      setMessage(`Support ticket ${result.ticket.id.slice(0, 8)} created with ${result.ticket.proofs.length} proof image${result.ticket.proofs.length === 1 ? "" : "s"}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create support ticket.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={`support-ticket-form ${mode === "modal" ? "compact" : ""}`} onSubmit={handleSubmit}>
      <div className="support-ticket-copy">
        <p>
          Create a support ticket for an HWID reset or proof review. The current HWID is included automatically with
          your request.
        </p>
        <div className="support-access-row">
          <StatusPill variant="large">{licenseType} support</StatusPill>
          {prioritySupport ? <StatusPill variant="lifetime">Lifetime priority</StatusPill> : null}
        </div>
        <div className="activation-hwid support-hwid">
          <span>Included HWID</span>
          <code>{hwid}</code>
        </div>
      </div>

      <div className="support-fields">
        <label>
          <span>Subject</span>
          <input
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setError("");
            }}
            maxLength={120}
            placeholder="HWID reset request"
            disabled={isSubmitting}
          />
        </label>
        <label>
          <span>Description</span>
          <textarea
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setError("");
            }}
            maxLength={2000}
            placeholder="Describe what changed and include purchase details."
            disabled={isSubmitting}
          />
        </label>
      </div>

      <label
        className={isDragging ? "proof-dropzone dragging" : "proof-dropzone"}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          multiple
          onChange={handleInputChange}
          disabled={isSubmitting}
        />
        <span className="dropzone-icon">
          {isDragging ? <UploadCloud size={24} aria-hidden="true" /> : <ImagePlus size={24} aria-hidden="true" />}
        </span>
        <span className="dropzone-main">Drop proof images here</span>
        <span className="dropzone-sub">
          PNG or JPG, up to {SUPPORT_MAX_IMAGES} images, {formatBytes(SUPPORT_MAX_IMAGE_BYTES)} each
        </span>
      </label>

      {proofs.length ? (
        <div className="proof-preview-grid" aria-label="Attached proof image previews">
          {proofs.map((proof) => (
            <article className="proof-preview-card" key={proof.id}>
              <img src={proof.previewUrl} alt={`Preview of ${proof.file.name}`} />
              <div>
                <strong>{proof.file.name}</strong>
                <span>{formatBytes(proof.file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeProof(proof.id)}
                aria-label={`Remove ${proof.file.name}`}
                disabled={isSubmitting}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="proof-empty-state">
          <FileImage size={18} aria-hidden="true" />
          <span>No proof images attached yet.</span>
        </div>
      )}

      <div className="support-submit-row">
        <span className="proof-count">
          <Paperclip size={15} aria-hidden="true" />
          {proofs.length}/{SUPPORT_MAX_IMAGES} images, {formatBytes(totalBytes)}
        </span>
        <button className="license-submit wide modal-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin-icon" size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
          <span>{isSubmitting ? "Submitting" : "Submit ticket"}</span>
        </button>
      </div>

      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="admin-message" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
