#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod premium;

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SmartActionFinding {
    label: String,
    value: String,
    severity: String,
    detail: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SmartActionStep {
    label: String,
    detail: String,
    status: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SmartActionReport {
    id: String,
    title: String,
    timestamp: String,
    summary: String,
    score: Option<u8>,
    before_snapshot: Option<String>,
    after_snapshot: Option<String>,
    findings: Vec<SmartActionFinding>,
    steps: Vec<SmartActionStep>,
    actions_taken: Vec<String>,
    skipped_actions: Vec<String>,
    errors: Vec<String>,
    undo_info: Vec<String>,
    log_path: Option<String>,
    export_path: Option<String>,
    raw: Option<serde_json::Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GameSessionResult {
    report: SmartActionReport,
    undo_token: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MaintenanceResult {
    detail: String,
    path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CleanupMove {
    original_path: String,
    quarantine_path: String,
    bytes: u64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CleanupManifest {
    created_at: String,
    moves: Vec<CleanupMove>,
}

#[tauri::command]
fn get_device_hwid() -> Result<String, String> {
    let source = device_fingerprint_source()?;
    Ok(format!("HWID-{:016X}", fnv1a64(source.as_bytes())))
}

fn feature_for_action(action_id: &str) -> Result<&'static str, String> {
    match action_id {
        "smart-game-prep" => Ok("smart-game-prep"),
        "game-optimizer-session" => Ok("game-optimizer-session"),
        "lag-cause-analyzer" => Ok("lag-cause-analyzer"),
        "network-stability-doctor" => Ok("network-stability-doctor"),
        "safe-cleanup-plan" => Ok("safe-cleanup-plan"),
        "session-report" => Ok("session-report"),
        "extreme-optimization" => Ok("extreme-optimization"),
        "gaming-optimization" => Ok("gaming-optimization"),
        "deep-diagnostics" => Ok("deep-diagnostics"),
        "resource-management" => Ok("resource-management"),
        "bottleneck-detection" => Ok("bottleneck-detection"),
        "background-suppression" => Ok("background-suppression"),
        "performance-tuning" => Ok("performance-tuning"),
        "network-stabilization" => Ok("network-stabilization"),
        "cache-shader-cleanup" => Ok("cache-shader-cleanup"),
        "session-restoration" => Ok("session-restoration"),
        "performance-analytics" => Ok("performance-analytics"),
        _ => Err("Unknown Smart Action.".to_string()),
    }
}

fn ensure_feature_access_checked(feature: &str, license_type: &str) -> Result<(), String> {
    if is_premium_feature(feature) {
        return Err("Premium addon required for this feature. Use the Premium section.".to_string());
    }
    ensure_feature_access(feature, license_type)
}

fn normalized_license_type(license_type: &str) -> &'static str {
    match license_type.trim().to_ascii_uppercase().as_str() {
        "PRO" => "PRO",
        "LIFETIME" => "LIFETIME",
        _ => "LITE",
    }
}

fn plan_rank(license_type: &str) -> u8 {
    match normalized_license_type(license_type) {
        "LIFETIME" => 2,
        "PRO" => 1,
        _ => 0,
    }
}

fn required_plan_for_feature(feature: &str) -> &'static str {
    match feature {
        "basic-system-status"
        | "game-optimizer-session"
        | "network-stability-doctor"
        | "safe-cleanup-plan"
        | "support-tickets" => "LITE",
        "smart-game-prep"
        | "game-optimizer-session-start"
        | "lag-cause-analyzer"
        | "cleanup-execute"
        | "session-report"
        | "export-reports" => "PRO",
        "advanced-report-history"
        | "extra-deep-diagnostics"
        | "priority-support"
        | "lifetime-badge"
        | "early-access-tools" => "LIFETIME",
        _ => "LIFETIME",
    }
}

fn can_use_feature(feature: &str, license_type: &str) -> bool {
    plan_rank(license_type) >= plan_rank(required_plan_for_feature(feature))
}

const PREMIUM_FEATURES: [&str; 11] = [
    "extreme-optimization",
    "gaming-optimization",
    "deep-diagnostics",
    "resource-management",
    "bottleneck-detection",
    "background-suppression",
    "performance-tuning",
    "network-stabilization",
    "cache-shader-cleanup",
    "session-restoration",
    "performance-analytics",
];

fn is_premium_feature(feature: &str) -> bool {
    PREMIUM_FEATURES.contains(&feature)
}

fn can_use_premium_feature(feature: &str, license_type: &str, premium: bool) -> bool {
    premium && can_use_feature(feature, license_type)
}

fn ensure_premium_feature_access(feature: &str, license_type: &str, premium: bool) -> Result<(), String> {
    if !premium {
        return Err("Premium addon required for this feature.".to_string());
    }
    if !can_use_feature(feature, license_type) {
        let required = required_plan_for_feature(feature);
        return Err(format!("{required} plan required."));
    }
    Ok(())
}

#[tauri::command]
fn run_premium_smart_action(action_id: String, license_type: String, premium: bool) -> Result<SmartActionReport, String> {
    ensure_premium_feature_access(&action_id, &license_type, premium)?;
    premium::run_premium_command(&action_id, &license_type, premium)
}

fn ensure_feature_access(feature: &str, license_type: &str) -> Result<(), String> {
    if can_use_feature(feature, license_type) {
        return Ok(());
    }

    let required = required_plan_for_feature(feature);
    let message = if required == "LIFETIME" {
        "This tool is available with a LIFETIME license.".to_string()
    } else {
        format!("{required} plan required. Upgrade to {required} to use this feature.")
    };
    Err(message)
}

#[tauri::command]
fn run_smart_action(action_id: String, license_type: String) -> Result<SmartActionReport, String> {
    ensure_feature_access_checked(feature_for_action(&action_id)?, &license_type)?;
    let mut report = match action_id.as_str() {
        "smart-game-prep" => smart_game_prep(false, None)?,
        "game-optimizer-session" => game_optimizer_session(false, None, None, None)?,
        "lag-cause-analyzer" => lag_cause_analyzer()?,
        "network-stability-doctor" => network_stability_doctor()?,
        "safe-cleanup-plan" => safe_cleanup_plan()?,
        "session-report" => session_report()?,
        _ => return Err("Unknown Smart Action.".to_string()),
    };

    apply_plan_extensions(&mut report, &license_type);
    log_report(report)
}

#[tauri::command]
fn start_game_session(
    minutes: u32,
    license_type: String,
    selected_game_pid: Option<u32>,
    selected_game_name: Option<String>,
) -> Result<GameSessionResult, String> {
    ensure_feature_access("game-optimizer-session-start", &license_type)?;
    if selected_game_pid.is_none() {
        return Err("Select a detected game process before starting the session.".to_string());
    }
    let current_scheme = active_power_scheme().ok();
    let undo_token = current_scheme.clone();
    let mut report =
        game_optimizer_session(true, Some(minutes), selected_game_pid, selected_game_name)?;
    apply_plan_extensions(&mut report, &license_type);
    let report = log_report(report)?;
    Ok(GameSessionResult { report, undo_token })
}

#[tauri::command]
fn restore_game_session(
    undo_token: String,
    license_type: String,
) -> Result<SmartActionReport, String> {
    ensure_feature_access("game-optimizer-session-start", &license_type)?;
    let mut report = base_report(
        "game-optimizer-session",
        "Game Optimizer Session",
        "Game optimizer session restored. Previous power plan was reapplied when available.",
    );

    if undo_token.trim().is_empty() {
        report
            .skipped_actions
            .push("No previous power plan token was available.".to_string());
        report
            .undo_info
            .push("Nothing changed by this restore run.".to_string());
    } else {
        match Command::new("powercfg")
            .args(["/setactive", undo_token.trim()])
            .output()
        {
            Ok(output) if output.status.success() => {
                report
                    .actions_taken
                    .push(format!("Restored Windows power plan {}", undo_token.trim()));
                report
                    .undo_info
                    .push("Previous power plan has been restored.".to_string());
            }
            Ok(output) => {
                report
                    .errors
                    .push(String::from_utf8_lossy(&output.stderr).trim().to_string());
            }
            Err(error) => report
                .errors
                .push(format!("Unable to run powercfg restore: {error}")),
        }
    }

    report.steps.push(step(
        "Restore power plan",
        "Reapplied the captured power-plan GUID if one existed.",
        if report.errors.is_empty() {
            "done"
        } else {
            "error"
        },
    ));
    apply_plan_extensions(&mut report, &license_type);
    log_report(report)
}

#[tauri::command]
fn execute_cleanup_plan(license_type: String) -> Result<GameSessionResult, String> {
    ensure_feature_access("cleanup-execute", &license_type)?;
    let mut report = base_report(
        "safe-cleanup-plan",
        "Safe Cleanup Plan",
        "Cleanup candidates were moved to quarantine. No permanent deletion was performed.",
    );
    let candidates = cleanup_candidates();
    let mut quarantine_root = report_dir()?;
    quarantine_root.push("quarantine");
    quarantine_root.push(timestamp_file_part());
    fs::create_dir_all(&quarantine_root)
        .map_err(|error| format!("Unable to create cleanup quarantine: {error}"))?;

    let mut manifest = CleanupManifest {
        created_at: timestamp_iso(),
        moves: Vec::new(),
    };

    for (index, candidate) in candidates.iter().enumerate() {
        let file_name = candidate
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("cleanup-file");
        let mut quarantine_path = quarantine_root.clone();
        quarantine_path.push(format!("{index:04}-{}", sanitize_file_name(file_name)));
        let bytes = candidate
            .metadata()
            .map(|metadata| metadata.len())
            .unwrap_or(0);
        match fs::rename(candidate, &quarantine_path) {
            Ok(()) => {
                manifest.moves.push(CleanupMove {
                    original_path: candidate.to_string_lossy().to_string(),
                    quarantine_path: quarantine_path.to_string_lossy().to_string(),
                    bytes,
                });
            }
            Err(error) => report.errors.push(format!(
                "Skipped {} because it could not be moved: {error}",
                candidate.to_string_lossy()
            )),
        }
    }

    let bytes_total: u64 = manifest.moves.iter().map(|item| item.bytes).sum();
    let mut manifest_path = quarantine_root.clone();
    manifest_path.push("manifest.json");
    fs::write(
        &manifest_path,
        serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("Unable to serialize cleanup manifest: {error}"))?,
    )
    .map_err(|error| format!("Unable to write cleanup manifest: {error}"))?;

    push_text_finding(
        &mut report,
        "Files quarantined",
        &manifest.moves.len().to_string(),
        if manifest.moves.is_empty() {
            "good"
        } else {
            "watch"
        },
        "Only allowed temp/cache/log candidates were moved. Important user folders were excluded.",
    );
    push_text_finding(
        &mut report,
        "Space staged",
        &format!("{:.1} MB", bytes_total as f64 / 1_048_576.0),
        "good",
        "Files were moved into quarantine rather than permanently deleted.",
    );
    push_text_finding(
        &mut report,
        "Undo token",
        &manifest_path.to_string_lossy(),
        "good",
        "Use Undo cleanup while this manifest exists to move files back.",
    );

    report.steps = vec![
        step("Confirm cleanup", "User confirmed quarantine-based cleanup execution.", "done"),
        step("Apply exclusions", "Documents, Desktop, Pictures, browser profiles, game saves, Program Files, and Windows system folders were excluded.", "done"),
        step("Move candidates", "Matched files were moved to the 47Service quarantine folder.", "done"),
        step("Write cleanup report", "A manifest and Smart Action report were logged.", "done"),
    ];
    if manifest.moves.is_empty() {
        report
            .skipped_actions
            .push("No eligible cleanup files were found to quarantine.".to_string());
        report
            .undo_info
            .push("No cleanup undo needed because no files were moved.".to_string());
    } else {
        report.actions_taken.push(format!(
            "Moved {} temp/cache/log files into quarantine.",
            manifest.moves.len()
        ));
        report.undo_info.push(format!(
            "Undo cleanup reads {} and restores moved files when their original paths are still available.",
            manifest_path.to_string_lossy()
        ));
    }
    report.raw = Some(json!({ "manifest": manifest, "manifestPath": manifest_path }));
    apply_plan_extensions(&mut report, &license_type);
    Ok(GameSessionResult {
        report: log_report(report)?,
        undo_token: Some(manifest_path.to_string_lossy().to_string()),
    })
}

#[tauri::command]
fn restore_cleanup(undo_token: String, license_type: String) -> Result<SmartActionReport, String> {
    ensure_feature_access("cleanup-execute", &license_type)?;
    let mut report = base_report(
        "safe-cleanup-plan",
        "Safe Cleanup Plan",
        "Cleanup restore completed from the quarantine manifest.",
    );
    if undo_token.trim().is_empty() {
        report
            .skipped_actions
            .push("No cleanup undo token was available.".to_string());
        report
            .undo_info
            .push("Nothing changed by this restore run.".to_string());
        report.steps.push(step(
            "Read manifest",
            "No manifest path was provided.",
            "skipped",
        ));
        apply_plan_extensions(&mut report, &license_type);
        return log_report(report);
    }

    let manifest_path = PathBuf::from(undo_token.trim());
    let manifest_text = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("Unable to read cleanup manifest: {error}"))?;
    let manifest: CleanupManifest = serde_json::from_str(&manifest_text)
        .map_err(|error| format!("Unable to parse cleanup manifest: {error}"))?;

    let mut restored = 0usize;
    for item in &manifest.moves {
        let quarantine_path = PathBuf::from(&item.quarantine_path);
        let original_path = PathBuf::from(&item.original_path);
        if let Some(parent) = original_path.parent() {
            if let Err(error) = fs::create_dir_all(parent) {
                report.errors.push(format!(
                    "Could not recreate {}: {error}",
                    parent.to_string_lossy()
                ));
                continue;
            }
        }
        match fs::rename(&quarantine_path, &original_path) {
            Ok(()) => restored += 1,
            Err(error) => report.errors.push(format!(
                "Could not restore {}: {error}",
                original_path.to_string_lossy()
            )),
        }
    }

    report.actions_taken.push(format!(
        "Restored {restored} quarantined cleanup files to their original paths."
    ));
    report.undo_info.push(
        "Cleanup quarantine restore was attempted from the manifest; remaining errors are listed."
            .to_string(),
    );
    report.steps = vec![
        step("Read manifest", "Loaded the cleanup undo manifest.", "done"),
        step(
            "Restore files",
            "Moved quarantined files back to original paths where possible.",
            if report.errors.is_empty() {
                "done"
            } else {
                "warning"
            },
        ),
        step("Log restore", "Wrote a restore report.", "done"),
    ];
    let restore_severity = if report.errors.is_empty() {
        "good"
    } else {
        "watch"
    };
    push_text_finding(
        &mut report,
        "Files restored",
        &restored.to_string(),
        restore_severity,
        "Files are restored only when their quarantine copy and destination path are available.",
    );
    report.raw = Some(json!({ "manifestPath": manifest_path, "restored": restored }));
    apply_plan_extensions(&mut report, &license_type);
    log_report(report)
}

#[tauri::command]
fn export_smart_action_report(report_json: String, license_type: String) -> Result<String, String> {
    ensure_feature_access("export-reports", &license_type)?;
    let mut path = report_dir()?;
    path.push(format!("47service-report-{}.json", timestamp_file_part()));
    fs::write(&path, report_json).map_err(|error| format!("Unable to export report: {error}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn clear_app_cache(cleared_browser_keys: usize) -> Result<MaintenanceResult, String> {
    let mut cache_root = app_temp_dir()?;
    cache_root.push("cache");
    let mut removed_entries = 0usize;

    if cache_root.exists() {
        removed_entries = count_entries(&cache_root);
        fs::remove_dir_all(&cache_root)
            .map_err(|error| format!("Unable to clear 47Service cache: {error}"))?;
    }

    fs::create_dir_all(&cache_root)
        .map_err(|error| format!("Unable to recreate 47Service cache: {error}"))?;

    Ok(MaintenanceResult {
        detail: format!(
            "Cleared {removed_entries} desktop cache entries and {cleared_browser_keys} browser cache keys."
        ),
        path: Some(cache_root.to_string_lossy().to_string()),
    })
}

#[tauri::command]
fn export_local_logs(settings_json: String) -> Result<MaintenanceResult, String> {
    let reports_root = report_dir()?;
    let mut reports = Vec::new();

    if let Ok(entries) = fs::read_dir(&reports_root) {
        let mut paths = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
            .collect::<Vec<_>>();
        paths.sort();
        paths.reverse();

        for path in paths.into_iter().take(30) {
            let content = fs::read_to_string(&path).unwrap_or_else(|error| {
                format!("Unable to read {}: {error}", path.to_string_lossy())
            });
            reports.push(json!({
                "path": path,
                "content": content,
            }));
        }
    }

    let report_count = reports.len();
    let payload = json!({
        "exportedAt": timestamp_iso(),
        "settings": serde_json::from_str::<serde_json::Value>(&settings_json).unwrap_or(json!({})),
        "reportDirectory": reports_root,
        "reports": reports,
    });

    let mut export_path = app_temp_dir()?;
    export_path.push(format!("47service-local-logs-{}.json", timestamp_file_part()));
    fs::write(
        &export_path,
        serde_json::to_string_pretty(&payload)
            .map_err(|error| format!("Unable to serialize local logs: {error}"))?,
    )
    .map_err(|error| format!("Unable to export local logs: {error}"))?;

    Ok(MaintenanceResult {
        detail: format!("Exported {report_count} recent report log entries."),
        path: Some(export_path.to_string_lossy().to_string()),
    })
}

#[tauri::command]
fn set_launch_on_startup(enabled: bool) -> Result<MaintenanceResult, String> {
    set_windows_startup(enabled)?;
    Ok(MaintenanceResult {
        detail: if enabled {
            "47Service will launch when Windows starts.".to_string()
        } else {
            "47Service was removed from Windows startup.".to_string()
        },
        path: None,
    })
}

#[tauri::command]
fn get_launch_on_startup() -> Result<bool, String> {
    get_windows_startup_enabled()
}

#[cfg(target_os = "windows")]
fn device_fingerprint_source() -> Result<String, String> {
    let output = std::process::Command::new("reg")
        .args([
            "query",
            r"HKLM\SOFTWARE\Microsoft\Cryptography",
            "/v",
            "MachineGuid",
        ])
        .output()
        .map_err(|error| format!("Unable to read Windows machine id: {error}"))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.contains("MachineGuid") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(value) = parts.last() {
                    if !value.trim().is_empty() {
                        return Ok(value.trim().to_string());
                    }
                }
            }
        }
    }

    fallback_device_fingerprint_source()
}

#[cfg(not(target_os = "windows"))]
fn device_fingerprint_source() -> Result<String, String> {
    fallback_device_fingerprint_source()
}

fn fallback_device_fingerprint_source() -> Result<String, String> {
    let hostname = std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .unwrap_or_default();

    let user = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "unknown-user".to_string());

    let source = format!("{}:{}", hostname.trim(), user.trim());
    if source.trim_matches(':').is_empty() {
        return Err("Unable to build a device HWID.".to_string());
    }

    Ok(source)
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn smart_game_prep(
    apply_power_plan: bool,
    minutes: Option<u32>,
) -> Result<SmartActionReport, String> {
    let mut report = base_report(
        "smart-game-prep",
        "Smart Game Prep",
        "Game readiness scan completed with safe recommendations and undo details.",
    );
    let games = run_powershell(
        r#"
$names = 'steam','steamwebhelper','epicgameslauncher','battle.net','riotclientservices','minecraft','java','javaw','robloxplayerbeta','fortniteclient-win64-shipping','valorant','cs2','r5apex','overwatch','leagueclient','gta5'
Get-Process | Where-Object { $names -contains $_.ProcessName.ToLowerInvariant() } | Select-Object ProcessName,Id,CPU,WorkingSet64 | ConvertTo-Json -Compress
"#,
    );
    let heavy = run_powershell(
        r#"
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 8 ProcessName,Id,CPU,WorkingSet64 | ConvertTo-Json -Compress
"#,
    );
    let safe_close = run_powershell(
        r#"
$protected = 'system','idle','registry','secure system','smss','csrss','wininit','services','lsass','svchost','fontdrvhost','dwm','explorer','taskhostw','searchindexer','audiodg'
Get-Process |
  Where-Object { $protected -notcontains $_.ProcessName.ToLowerInvariant() -and $_.WorkingSet64 -gt 250MB } |
  Sort-Object WorkingSet64 -Descending |
  Select-Object -First 6 ProcessName,Id,@{n='MemoryMB';e={[math]::Round($_.WorkingSet64/1MB)}} |
  ConvertTo-Json -Compress
"#,
    );
    let memory = run_powershell(
        r#"
$os = Get-CimInstance Win32_OperatingSystem
[pscustomobject]@{ TotalMB=[math]::Round($os.TotalVisibleMemorySize/1024); FreeMB=[math]::Round($os.FreePhysicalMemory/1024) } | ConvertTo-Json -Compress
"#,
    );
    let disk = run_powershell(
        r#"
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,@{n='FreeGB';e={[math]::Round($_.FreeSpace/1GB,1)}},@{n='SizeGB';e={[math]::Round($_.Size/1GB,1)}} | ConvertTo-Json -Compress
"#,
    );

    push_text_finding(
        &mut report,
        "Running games",
        games.as_deref().unwrap_or("No game processes detected"),
        "good",
        "Matched common launchers and game executables from the current process list.",
    );
    push_text_finding(&mut report, "Heavy background apps", heavy.as_deref().unwrap_or("Unable to read process memory"), "watch", "Review high-memory apps before a session. 47Service only suggests; it does not close apps automatically.");
    push_text_finding(
        &mut report,
        "Safe close suggestions",
        safe_close
            .as_deref()
            .unwrap_or("No obvious safe-close candidates found."),
        "watch",
        "Suggested from high-memory non-system processes only. 47Service never closes them automatically.",
    );
    push_text_finding(
        &mut report,
        "RAM pressure",
        memory.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Free and total physical memory were read from Windows CIM.",
    );
    push_text_finding(
        &mut report,
        "Disk pressure",
        disk.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Fixed drives were checked for free space before the session.",
    );

    report.steps.push(step(
        "Detect running games",
        "Checked common game and launcher process names.",
        "done",
    ));
    report.steps.push(step(
        "Find heavy background apps",
        "Sorted processes by working set to identify safe close candidates.",
        "done",
    ));
    report.steps.push(step(
        "Verify RAM and disk pressure",
        "Read memory and fixed-drive free space.",
        "done",
    ));

    if apply_power_plan {
        match Command::new("powercfg")
            .args(["/setactive", "SCHEME_MIN"])
            .output()
        {
            Ok(output) if output.status.success() => {
                report.actions_taken.push("Switched Windows to the built-in High performance power plan for the timed session.".to_string());
                report.undo_info.push(
                    "Restore session reapplies the previously captured power plan GUID."
                        .to_string(),
                );
                report.steps.push(step(
          "Switch power plan",
          &format!("High performance requested for {} minutes. No security, network, boot, or registry settings were touched.", minutes.unwrap_or(60)),
          "done",
        ));
            }
            Ok(output) => {
                report
                    .errors
                    .push(String::from_utf8_lossy(&output.stderr).trim().to_string());
                report.steps.push(step(
                    "Switch power plan",
                    "Windows rejected the safe powercfg request.",
                    "error",
                ));
            }
            Err(error) => {
                report
                    .errors
                    .push(format!("Unable to run powercfg: {error}"));
                report.steps.push(step(
                    "Switch power plan",
                    "powercfg was unavailable.",
                    "error",
                ));
            }
        }
    } else {
        report.skipped_actions.push("Power plan was not changed during analysis. Use Start 60m session to apply a reversible session profile.".to_string());
        report
            .undo_info
            .push("No undo needed for the analysis run.".to_string());
        report.steps.push(step(
            "Prepare timed session",
            "Analysis only. No power-plan change was made.",
            "skipped",
        ));
    }

    report.raw = Some(
        json!({ "games": games, "heavyProcesses": heavy, "safeCloseSuggestions": safe_close, "memory": memory, "disk": disk }),
    );
    Ok(report)
}

fn game_optimizer_session(
    apply_power_plan: bool,
    minutes: Option<u32>,
    selected_game_pid: Option<u32>,
    selected_game_name: Option<String>,
) -> Result<SmartActionReport, String> {
    let mut report = base_report(
        "game-optimizer-session",
        "Game Optimizer Session",
        "Game process scan completed with safe session recommendations.",
    );
    let detected_games = run_powershell(
        r#"
$catalog = @{
  'steam'='Steam'; 'steamwebhelper'='Steam'; 'epicgameslauncher'='Epic Games Launcher';
  'battle.net'='Battle.net'; 'riotclientservices'='Riot Client'; 'minecraft'='Minecraft';
  'java'='Java game runtime'; 'javaw'='Java game runtime'; 'robloxplayerbeta'='Roblox';
  'fortniteclient-win64-shipping'='Fortnite'; 'valorant'='VALORANT'; 'cs2'='Counter-Strike 2';
  'r5apex'='Apex Legends'; 'overwatch'='Overwatch'; 'leagueclient'='League of Legends';
  'gta5'='Grand Theft Auto V'; 'cod'='Call of Duty'; 'warframe.x64'='Warframe'
}
$gpuByPid = @{}
try {
  $samples = (Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction Stop).CounterSamples
  foreach ($sample in $samples) {
    if ($sample.InstanceName -match 'pid_(\d+)') {
      $pidKey = $matches[1]
      if (-not $gpuByPid.ContainsKey($pidKey)) { $gpuByPid[$pidKey] = 0 }
      $gpuByPid[$pidKey] += $sample.CookedValue
    }
  }
} catch {}
Get-Process -ErrorAction SilentlyContinue |
  Where-Object {
    $name = $_.ProcessName.ToLowerInvariant()
    $catalog.ContainsKey($name) -or ($_.MainWindowTitle -and $_.MainWindowTitle -match 'game|minecraft|roblox|valorant|steam|epic|riot|battle|counter-strike|fortnite|apex|overwatch|league|warframe')
  } |
  Sort-Object WorkingSet64 -Descending |
  Select-Object -First 16 @{n='GameName';e={
      $key = $_.ProcessName.ToLowerInvariant()
      if ($catalog.ContainsKey($key)) { $catalog[$key] } elseif ($_.MainWindowTitle) { $_.MainWindowTitle } else { $_.ProcessName }
    }},
    @{n='ProcessName';e={$_.ProcessName}},
    @{n='Pid';e={$_.Id}},
    @{n='RamMB';e={[math]::Round($_.WorkingSet64/1MB)}},
    @{n='CpuUsage';e={ if ($_.CPU -ne $null) { ([math]::Round($_.CPU,1)).ToString() + 's' } else { $null } }},
    @{n='GpuUsage';e={ $pidKey = [string]$_.Id; if ($gpuByPid.ContainsKey($pidKey)) { ([math]::Round($gpuByPid[$pidKey],1)).ToString() + '%' } else { $null } }},
    @{n='WindowTitle';e={$_.MainWindowTitle}} |
  ConvertTo-Json -Compress
"#,
    );
    let heavy = run_powershell(
        r#"
$protected = 'system','idle','registry','secure system','smss','csrss','wininit','services','lsass','svchost','fontdrvhost','dwm','explorer','taskhostw','searchindexer','audiodg'
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $protected -notcontains $_.ProcessName.ToLowerInvariant() -and $_.WorkingSet64 -gt 250MB } |
  Sort-Object WorkingSet64 -Descending |
  Select-Object -First 8 ProcessName,Id,@{n='MemoryMB';e={[math]::Round($_.WorkingSet64/1MB)}},@{n='CPUSeconds';e={if ($_.CPU -ne $null) {[math]::Round($_.CPU,1)} else {$null}}} |
  ConvertTo-Json -Compress
"#,
    );
    let memory = run_powershell("$os=Get-CimInstance Win32_OperatingSystem; [pscustomobject]@{TotalMB=[math]::Round($os.TotalVisibleMemorySize/1024);FreeMB=[math]::Round($os.FreePhysicalMemory/1024)} | ConvertTo-Json -Compress");
    let cpu = run_powershell("Get-CimInstance Win32_Processor | Select-Object Name,LoadPercentage | ConvertTo-Json -Compress");
    let disk = run_powershell("Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk | Where-Object {$_.Name -eq '_Total'} | Select-Object PercentDiskTime,AvgDiskQueueLength | ConvertTo-Json -Compress");
    let network = run_shell("ping", &["-n", "4", "1.1.1.1"]);
    let selected_summary = selected_game_pid
        .map(|pid| {
            format!(
                "{} ({pid})",
                selected_game_name
                    .as_deref()
                    .filter(|name| !name.trim().is_empty())
                    .unwrap_or("Selected game")
            )
        })
        .unwrap_or_else(|| "No game selected for a timed session.".to_string());

    push_text_finding(
        &mut report,
        "Detected games",
        detected_games
            .as_deref()
            .unwrap_or("No game process detected"),
        "good",
        "Matches common game launchers, game executables, and visible game-like window titles.",
    );
    push_text_finding(
        &mut report,
        "Selected game",
        &selected_summary,
        if selected_game_pid.is_some() {
            "good"
        } else {
            "watch"
        },
        "Timed sessions require a selected detected game process.",
    );
    push_text_finding(&mut report, "Heavy background apps", heavy.as_deref().unwrap_or("Unable to read heavy background apps"), "watch", "Review high-memory user apps before a session. 47Service recommends closing them yourself instead of ending processes automatically.");
    push_text_finding(
        &mut report,
        "RAM pressure",
        memory.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Free and total physical memory were read from Windows CIM.",
    );
    push_text_finding(
        &mut report,
        "CPU pressure",
        cpu.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Current CPU load was read without changing processor settings.",
    );
    push_text_finding(
        &mut report,
        "Disk pressure",
        disk.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Disk queue pressure was read without stopping services or editing storage settings.",
    );
    push_text_finding(
        &mut report,
        "Network instability",
        network.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Ping output is used only to flag packet loss or timeouts.",
    );
    push_text_finding(
        &mut report,
        "Safe action suggestions",
        "Use high performance power plan, close only trusted heavy user apps manually, and avoid downloads during play.",
        "good",
        "47Service does not disable security, edit registry keys, stop services, or promise artificial performance boosts.",
    );

    report.steps = vec![
        step(
            "Detect running games",
            "Checked known game executables, launchers, and visible game-like windows.",
            "done",
        ),
        step(
            "Show process metrics",
            "Collected game name, process name, PID, RAM, CPU, and GPU usage when Windows exposed it.",
            "done",
        ),
        step(
            "Find heavy background apps",
            "Listed high-memory non-system processes as manual close suggestions only.",
            "done",
        ),
        step(
            "Check system pressure",
            "Read RAM, CPU, disk, and network signals before the session.",
            "done",
        ),
    ];

    if apply_power_plan {
        match Command::new("powercfg")
            .args(["/setactive", "SCHEME_MIN"])
            .output()
        {
            Ok(output) if output.status.success() => {
                report.actions_taken.push(format!(
                    "Started a {} minute Game Optimizer Session for {selected_summary}.",
                    minutes.unwrap_or(60)
                ));
                report.actions_taken.push("Switched Windows to the built-in High performance power plan for the timed session.".to_string());
                report.skipped_actions.push("No background apps were closed automatically. Review suggestions and close trusted apps yourself.".to_string());
                report.skipped_actions.push(
                    "No non-critical in-app background checks were active to pause.".to_string(),
                );
                report.undo_info.push(
                    "Restore session reapplies the previously captured power plan GUID."
                        .to_string(),
                );
                report.steps.push(step(
                    "Switch power plan",
                    &format!("High performance requested for {} minutes. No security, network, boot, registry, or service settings were touched.", minutes.unwrap_or(60)),
                    "done",
                ));
            }
            Ok(output) => {
                report
                    .errors
                    .push(String::from_utf8_lossy(&output.stderr).trim().to_string());
                report.steps.push(step(
                    "Switch power plan",
                    "Windows rejected the safe powercfg request.",
                    "error",
                ));
            }
            Err(error) => {
                report
                    .errors
                    .push(format!("Unable to run powercfg: {error}"));
                report.steps.push(step(
                    "Switch power plan",
                    "powercfg was unavailable.",
                    "error",
                ));
            }
        }
    } else {
        report.skipped_actions.push("Timed optimization was not started. LITE can view detected games only; PRO can start a reversible session.".to_string());
        report
            .undo_info
            .push("No undo needed because the detection workflow is read-only.".to_string());
        report.steps.push(step(
            "Prepare timed session",
            "Detection only. No power-plan change was made.",
            "skipped",
        ));
    }

    report.raw = Some(json!({
        "detectedGames": json_from_text(detected_games.as_deref()),
        "heavyProcesses": json_from_text(heavy.as_deref()),
        "memory": json_from_text(memory.as_deref()),
        "cpu": json_from_text(cpu.as_deref()),
        "disk": json_from_text(disk.as_deref()),
        "network": network,
        "selectedGamePid": selected_game_pid,
        "selectedGameName": selected_game_name
    }));
    Ok(report)
}

fn lag_cause_analyzer() -> Result<SmartActionReport, String> {
    let mut report = base_report(
    "lag-cause-analyzer",
    "Lag Cause Analyzer",
    "Combined bottleneck analysis completed across CPU, RAM, disk, network, and background apps.",
  );
    let cpu = run_powershell("Get-CimInstance Win32_Processor | Select-Object Name,LoadPercentage | ConvertTo-Json -Compress");
    let memory = run_powershell("$os=Get-CimInstance Win32_OperatingSystem; [pscustomobject]@{TotalMB=[math]::Round($os.TotalVisibleMemorySize/1024);FreeMB=[math]::Round($os.FreePhysicalMemory/1024)} | ConvertTo-Json -Compress");
    let disk = run_powershell("Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk | Where-Object {$_.Name -eq '_Total'} | Select-Object PercentDiskTime,AvgDiskQueueLength | ConvertTo-Json -Compress");
    let network = run_shell("ping", &["-n", "4", "1.1.1.1"]);
    let heavy = run_powershell("Get-Process | Sort-Object CPU -Descending | Select-Object -First 8 ProcessName,Id,CPU,WorkingSet64 | ConvertTo-Json -Compress");

    push_text_finding(
        &mut report,
        "CPU",
        cpu.as_deref().unwrap_or("Unavailable"),
        "watch",
        "High load suggests CPU-bound lag.",
    );
    push_text_finding(
        &mut report,
        "RAM",
        memory.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Low free memory suggests stutter from paging.",
    );
    push_text_finding(
        &mut report,
        "Disk",
        disk.as_deref().unwrap_or("Unavailable"),
        "watch",
        "High disk time or queue length suggests storage stalls.",
    );
    push_text_finding(
        &mut report,
        "Network",
        network.as_deref().unwrap_or("Ping unavailable"),
        "watch",
        "Packet loss or high latency suggests connection instability.",
    );
    push_text_finding(
        &mut report,
        "Background apps",
        heavy.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Top CPU consumers are candidates to close manually.",
    );
    let likely = likely_bottleneck(
        cpu.as_deref().unwrap_or_default(),
        memory.as_deref().unwrap_or_default(),
        disk.as_deref().unwrap_or_default(),
        network.as_deref().unwrap_or_default(),
        heavy.as_deref().unwrap_or_default(),
    );
    push_text_finding(
        &mut report,
        "Likely bottleneck",
        &likely,
        "good",
        "Combines the CPU, RAM, disk, network, and background-app checks into one plain-language result.",
    );

    report.steps = vec![
        step("CPU check", "Read processor load.", "done"),
        step("RAM check", "Read total and free physical memory.", "done"),
        step("Disk check", "Read disk time and queue length.", "done"),
        step("Network check", "Pinged 1.1.1.1 four times.", "done"),
        step(
            "Recommendation",
            &format!("No changes made. Safe next action: {likely}"),
            "done",
        ),
    ];
    report
        .skipped_actions
        .push("No process was closed and no system setting was changed.".to_string());
    report
        .undo_info
        .push("No undo needed because the analyzer is read-only.".to_string());
    report.raw = Some(
        json!({ "cpu": cpu, "memory": memory, "disk": disk, "network": network, "heavyProcesses": heavy }),
    );
    Ok(report)
}

fn network_stability_doctor() -> Result<SmartActionReport, String> {
    let mut report = base_report(
        "network-stability-doctor",
        "Network Stability Doctor",
        "Network stability tests completed and a support-ready report was logged.",
    );
    let gateway = run_powershell("$gw=(Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway} | Select-Object -First 1).IPv4DefaultGateway.NextHop; if($gw){ ping -n 4 $gw } else { 'No IPv4 gateway found' }");
    let cloudflare = run_shell("ping", &["-n", "4", "1.1.1.1"]);
    let google = run_shell("ping", &["-n", "4", "8.8.8.8"]);
    let dns = run_powershell("Measure-Command { Resolve-DnsName example.com -ErrorAction Stop | Out-Null } | Select-Object TotalMilliseconds | ConvertTo-Json -Compress");
    let score = stability_score(&[
        gateway.as_deref(),
        cloudflare.as_deref(),
        google.as_deref(),
        dns.as_deref(),
    ]);

    push_text_finding(
        &mut report,
        "Gateway latency",
        gateway.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Tests the local router path.",
    );
    push_text_finding(
        &mut report,
        "Cloudflare ping",
        cloudflare.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Checks public internet latency and packet loss.",
    );
    push_text_finding(
        &mut report,
        "Google ping",
        google.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Adds a second endpoint to avoid single-host bias.",
    );
    push_text_finding(
        &mut report,
        "DNS response",
        dns.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Measures DNS lookup time for example.com.",
    );
    push_text_finding(
        &mut report,
        "Packet loss",
        &packet_loss_summary(&[gateway.as_deref(), cloudflare.as_deref(), google.as_deref()]),
        if score >= 80 { "good" } else { "warning" },
        "Summarizes loss across gateway and public endpoint pings.",
    );
    report.score = Some(score);
    report.steps = vec![
        step(
            "Gateway test",
            "Pinged the default IPv4 gateway when detected.",
            "done",
        ),
        step("Endpoint pings", "Pinged 1.1.1.1 and 8.8.8.8.", "done"),
        step("DNS response", "Measured Resolve-DnsName duration.", "done"),
        step("Support report", "Logged all results for export.", "done"),
    ];
    report
        .skipped_actions
        .push("No DNS, adapter, firewall, or router settings were changed.".to_string());
    report
        .undo_info
        .push("No undo needed because the doctor is read-only.".to_string());
    report.raw =
        Some(json!({ "gateway": gateway, "cloudflare": cloudflare, "google": google, "dns": dns }));
    Ok(report)
}

fn safe_cleanup_plan() -> Result<SmartActionReport, String> {
    let mut report = base_report(
        "safe-cleanup-plan",
        "Safe Cleanup Plan",
        "Cleanup plan prepared. No files were deleted.",
    );
    let scan = run_powershell(
        r#"
$targets = @(
  @{Name='User temp';Path=$env:TEMP},
  @{Name='Windows temp';Path="$env:WINDIR\Temp"},
  @{Name='Crash dumps';Path="$env:LOCALAPPDATA\CrashDumps"},
  @{Name='47Service logs';Path="$env:TEMP\47Service\reports"}
)
$targets | ForEach-Object {
  $exists = Test-Path $_.Path
  $size = 0
  $count = 0
  if ($exists) {
    $items = Get-ChildItem $_.Path -Force -ErrorAction SilentlyContinue
    $count = @($items).Count
    $size = ($items | Measure-Object Length -Sum).Sum
  }
  [pscustomobject]@{ Category=$_.Name; Path=$_.Path; Exists=$exists; Count=$count; SizeMB=[math]::Round($size/1MB,1); Protected=$false }
} | ConvertTo-Json -Compress
"#,
    );
    let candidates = cleanup_candidates();
    let exact_candidates = if candidates.is_empty() {
        "No eligible files found.".to_string()
    } else {
        candidates
            .iter()
            .take(20)
            .map(|path| path.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join("\n")
    };
    push_text_finding(
        &mut report,
        "Cleanup candidates",
        scan.as_deref().unwrap_or("Unavailable"),
        "watch",
        "Lists categories, paths, counts, and sizes for review.",
    );
    push_text_finding(
        &mut report,
        "Exact files",
        &exact_candidates,
        if candidates.is_empty() { "good" } else { "watch" },
        "Shows the exact eligible files 47Service would quarantine after confirmation, capped to the first 20 in the UI.",
    );
    push_text_finding(
        &mut report,
        "Candidate count",
        &candidates.len().to_string(),
        "good",
        "The full candidate list is included in the raw report data.",
    );
    push_text_finding(
        &mut report,
        "Excluded folders",
        "Windows, Program Files, user Documents/Desktop/Pictures, browser profiles, game saves",
        "good",
        "Important folders are excluded by design.",
    );
    report.steps = vec![
        step(
            "Scan temp/cache/log folders",
            "Measured safe cleanup categories.",
            "done",
        ),
        step(
            "Apply exclusions",
            "Important folders were excluded.",
            "done",
        ),
        step(
            "Wait for confirmation",
            "Deletion is not performed from the planning scan.",
            "skipped",
        ),
        step(
            "Create cleanup report",
            "Plan was logged for review.",
            "done",
        ),
    ];
    report.skipped_actions.push(
        "No files were deleted. Cleanup requires a separate explicit confirmation.".to_string(),
    );
    report.undo_info.push("No undo needed for scan. If cleanup is later added, deleted-file undo limits must be reported per category.".to_string());
    report.raw = Some(json!({ "scan": scan, "candidates": candidates }));
    Ok(report)
}

fn session_report() -> Result<SmartActionReport, String> {
    let mut report = base_report(
        "session-report",
        "Session Report",
        "Session report generated from the 47Service report folder.",
    );
    let mut count = 0usize;
    let mut latest = "No previous reports found.".to_string();
    if let Ok(dir) = report_dir() {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|value| value.to_str()) == Some("json") {
                    count += 1;
                    latest = path.to_string_lossy().to_string();
                }
            }
        }
    }
    push_text_finding(
        &mut report,
        "Reports logged",
        &count.to_string(),
        "good",
        "Counts JSON Smart Action reports written by 47Service.",
    );
    push_text_finding(
        &mut report,
        "Latest report",
        &latest,
        "watch",
        "Use Export report from any workflow to create a support-ready copy.",
    );
    report.steps = vec![
        step(
            "Read report folder",
            "Inspected the local report directory.",
            "done",
        ),
        step(
            "Summarize audit trail",
            "Counted available reports and identified the latest path.",
            "done",
        ),
    ];
    report
        .skipped_actions
        .push("No optimizer action was run by Session Report.".to_string());
    report
        .undo_info
        .push("No undo needed because only report metadata was read.".to_string());
    report.raw = Some(json!({ "count": count, "latest": latest }));
    Ok(report)
}

fn base_report(id: &str, title: &str, summary: &str) -> SmartActionReport {
    SmartActionReport {
        id: id.to_string(),
        title: title.to_string(),
        timestamp: timestamp_iso(),
        summary: summary.to_string(),
        score: None,
        before_snapshot: Some(system_snapshot()),
        after_snapshot: None,
        findings: Vec::new(),
        steps: Vec::new(),
        actions_taken: Vec::new(),
        skipped_actions: Vec::new(),
        errors: Vec::new(),
        undo_info: Vec::new(),
        log_path: None,
        export_path: None,
        raw: None,
    }
}

fn apply_plan_extensions(report: &mut SmartActionReport, license_type: &str) {
    if normalized_license_type(license_type) != "LIFETIME" {
        return;
    }

    let diagnostics = extra_deep_diagnostics_snapshot();
    push_text_finding(
        report,
        "Extra deep diagnostics",
        &diagnostics,
        "watch",
        "LIFETIME reports include additional read-only system signals for long-term troubleshooting.",
    );
    report.steps.push(step(
        "Run lifetime diagnostics",
        "Collected additional read-only signals for the LIFETIME report.",
        "done",
    ));

    if report.id == "session-report" {
        let history = advanced_report_history();
        push_text_finding(
            report,
            "Advanced report history",
            &history,
            "good",
            "LIFETIME Session Report includes a deeper local report-history summary.",
        );
    }

    report
        .actions_taken
        .push("Applied LIFETIME report enrichment.".to_string());
}

fn extra_deep_diagnostics_snapshot() -> String {
    run_powershell(
        r#"
$processCount = (Get-Process -ErrorAction SilentlyContinue | Measure-Object).Count
$services = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue
$runningServices = ($services | Where-Object { $_.State -eq 'Running' } | Measure-Object).Count
$startupApps = (Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue | Measure-Object).Count
[pscustomobject]@{
  ProcessCount=$processCount
  RunningServices=$runningServices
  StartupItems=$startupApps
} | ConvertTo-Json -Compress
"#,
    )
    .unwrap_or_else(|| "Extra diagnostics unavailable on this device.".to_string())
}

fn advanced_report_history() -> String {
    let Ok(dir) = report_dir() else {
        return "Report folder unavailable.".to_string();
    };
    let Ok(entries) = fs::read_dir(&dir) else {
        return "Report history unavailable.".to_string();
    };

    let mut names = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                return None;
            }
            path.file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.to_string())
        })
        .collect::<Vec<_>>();
    names.sort();
    names.reverse();

    if names.is_empty() {
        "No previous report files found.".to_string()
    } else {
        format!(
            "{} report files tracked. Latest: {}",
            names.len(),
            names.into_iter().take(5).collect::<Vec<_>>().join(", ")
        )
    }
}

fn push_text_finding(
    report: &mut SmartActionReport,
    label: &str,
    value: &str,
    severity: &str,
    detail: &str,
) {
    report.findings.push(SmartActionFinding {
        label: label.to_string(),
        value: trim_text(value, 720),
        severity: severity.to_string(),
        detail: detail.to_string(),
    });
}

fn step(label: &str, detail: &str, status: &str) -> SmartActionStep {
    SmartActionStep {
        label: label.to_string(),
        detail: detail.to_string(),
        status: status.to_string(),
    }
}

fn run_powershell(script: &str) -> Option<String> {
    run_shell(
        "powershell",
        &[
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ],
    )
}

fn run_shell(program: &str, args: &[&str]) -> Option<String> {
    match Command::new(program).args(args).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if output.status.success() && !stdout.is_empty() {
                Some(trim_text(&stdout, 1800))
            } else if !stderr.is_empty() {
                Some(trim_text(&stderr, 900))
            } else {
                None
            }
        }
        Err(error) => Some(format!("{program} unavailable: {error}")),
    }
}

fn json_from_text(value: Option<&str>) -> serde_json::Value {
    value
        .and_then(|text| serde_json::from_str::<serde_json::Value>(text).ok())
        .unwrap_or(serde_json::Value::Null)
}

fn cleanup_candidates() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(temp) = std::env::var("TEMP") {
        roots.push(PathBuf::from(temp));
    }
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        roots.push(PathBuf::from(&local_app_data).join("CrashDumps"));
        roots.push(PathBuf::from(&local_app_data).join("D3DSCache"));
        roots.push(PathBuf::from(&local_app_data).join("Temp"));
    }
    if let Ok(mut reports) = report_dir() {
        reports.pop();
        roots.push(reports.join("reports"));
    }

    let mut candidates = Vec::new();
    for root in roots {
        collect_cleanup_files(&root, &root, 0, &mut candidates);
    }
    candidates.sort();
    candidates.dedup();
    candidates.truncate(500);
    candidates
}

fn collect_cleanup_files(root: &Path, current: &Path, depth: usize, candidates: &mut Vec<PathBuf>) {
    if depth > 2 || !is_allowed_cleanup_root(root) || is_protected_path(current) {
        return;
    }
    let Ok(entries) = fs::read_dir(current) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if is_protected_path(&path) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.is_dir() {
            collect_cleanup_files(root, &path, depth + 1, candidates);
        } else if metadata.is_file() && is_cleanup_candidate_file(&path, &metadata) {
            candidates.push(path);
        }
    }
}

fn is_allowed_cleanup_root(path: &Path) -> bool {
    let text = path.to_string_lossy().to_ascii_lowercase();
    text.contains("\\temp")
        || text.contains("\\crashdumps")
        || text.contains("\\d3dscache")
        || text.contains("\\47service\\reports")
}

fn is_protected_path(path: &Path) -> bool {
    let text = path.to_string_lossy().to_ascii_lowercase();
    let protected = [
        "\\documents",
        "\\desktop",
        "\\pictures",
        "\\videos",
        "\\music",
        "\\program files",
        "\\windows\\system32",
        "\\appdata\\roaming\\.minecraft",
        "\\appdata\\roaming\\discord",
        "\\appdata\\local\\google\\chrome",
        "\\appdata\\local\\microsoft\\edge",
        "\\steam\\steamapps",
        "\\epic games",
    ];
    protected.iter().any(|needle| text.contains(needle))
}

fn is_cleanup_candidate_file(path: &Path, metadata: &fs::Metadata) -> bool {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let allowed_extension = matches!(
        extension.as_str(),
        "tmp" | "temp" | "log" | "dmp" | "old" | "bak" | "etl"
    );
    if !allowed_extension {
        return false;
    }
    if let Ok(modified) = metadata.modified() {
        if let Ok(age) = SystemTime::now().duration_since(modified) {
            return age.as_secs() > 60 * 60 * 24;
        }
    }
    false
}

fn sanitize_file_name(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn active_power_scheme() -> Result<String, String> {
    let output = Command::new("powercfg")
        .args(["/getactivescheme"])
        .output()
        .map_err(|error| format!("Unable to run powercfg: {error}"))?;
    let text = String::from_utf8_lossy(&output.stdout);
    text.split_whitespace()
        .find(|part| part.len() == 36 && part.chars().filter(|ch| *ch == '-').count() == 4)
        .map(|value| value.to_string())
        .ok_or_else(|| "Unable to parse active power scheme.".to_string())
}

fn stability_score(values: &[Option<&str>]) -> u8 {
    let mut score = 100i32;
    for value in values.iter().flatten() {
        let lower = value.to_lowercase();
        if lower.contains("lost = 0") || lower.contains("0% loss") {
            score -= 0;
        } else if lower.contains("lost =") || lower.contains("loss") {
            score -= 22;
        }
        if lower.contains("timed out")
            || lower.contains("could not")
            || lower.contains("unavailable")
        {
            score -= 18;
        }
    }
    score.clamp(0, 100) as u8
}

fn likely_bottleneck(cpu: &str, memory: &str, disk: &str, network: &str, heavy: &str) -> String {
    let cpu_lower = cpu.to_ascii_lowercase();
    let disk_lower = disk.to_ascii_lowercase();
    let network_lower = network.to_ascii_lowercase();
    let memory_lower = memory.to_ascii_lowercase();
    if network_lower.contains("lost = 1")
        || network_lower.contains("lost = 2")
        || network_lower.contains("lost = 3")
        || network_lower.contains("lost = 4")
        || network_lower.contains("timed out")
    {
        return "Network instability. Check Wi-Fi signal, router load, or ISP packet loss before changing PC settings.".to_string();
    }
    if cpu_lower.contains("\"loadpercentage\":9") || cpu_lower.contains("loadpercentage\":100") {
        return "CPU pressure. Close CPU-heavy background apps and lower CPU-bound game settings."
            .to_string();
    }
    if disk_lower.contains("avgdiskqueuelength\":1")
        || disk_lower.contains("avgdiskqueuelength\":2")
        || disk_lower.contains("percentdisktime\":9")
    {
        return "Disk pressure. Free space, pause launchers/updaters, and avoid game installs during play.".to_string();
    }
    if memory_lower.contains("freemb\":0") || memory_lower.contains("freemb\":1") {
        return "RAM pressure. Close browsers/launchers and reduce memory-heavy mods or texture packs.".to_string();
    }
    if !heavy.trim().is_empty() {
        return "Background-app pressure. Review top CPU/RAM apps and close only work you recognize.".to_string();
    }
    "No single bottleneck dominates. Keep settings conservative and rerun while the lag is happening.".to_string()
}

fn packet_loss_summary(values: &[Option<&str>]) -> String {
    let joined = values
        .iter()
        .flatten()
        .map(|value| value.to_ascii_lowercase())
        .collect::<Vec<_>>()
        .join("\n");
    if joined.contains("lost = 0") || joined.contains("0% loss") {
        "No packet loss reported by successful ping tests.".to_string()
    } else if joined.contains("lost =") || joined.contains("% loss") || joined.contains("timed out")
    {
        "Packet loss or timeouts detected in one or more ping tests.".to_string()
    } else {
        "Packet loss could not be parsed from the ping output.".to_string()
    }
}

fn log_report(mut report: SmartActionReport) -> Result<SmartActionReport, String> {
    if report.after_snapshot.is_none() {
        report.after_snapshot = Some(system_snapshot());
    }
    let mut path = report_dir()?;
    path.push(format!("{}-{}.json", report.id, timestamp_file_part()));
    let mut report_for_file = report.clone();
    report_for_file.log_path = Some(path.to_string_lossy().to_string());
    let data = serde_json::to_string_pretty(&report_for_file)
        .map_err(|error| format!("Unable to serialize report: {error}"))?;
    fs::write(&path, data).map_err(|error| format!("Unable to write report log: {error}"))?;
    report.log_path = Some(path.to_string_lossy().to_string());
    Ok(report)
}

fn system_snapshot() -> String {
    run_powershell(
        r#"
$os = Get-CimInstance Win32_OperatingSystem
$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).LoadPercentage
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object -First 1
$freeDisk = $null
if ($disk) { $freeDisk = [math]::Round($disk.FreeSpace/1GB,1) }
[pscustomobject]@{
  CpuLoad=$cpu
  FreeMemoryMB=[math]::Round($os.FreePhysicalMemory/1024)
  SystemDriveFreeGB=$freeDisk
} | ConvertTo-Json -Compress
"#,
    )
    .unwrap_or_else(|| "Snapshot unavailable".to_string())
}

fn report_dir() -> Result<PathBuf, String> {
    let mut dir = app_temp_dir()?;
    dir.push("reports");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Unable to create report directory: {error}"))?;
    Ok(dir)
}

fn app_temp_dir() -> Result<PathBuf, String> {
    let mut dir = std::env::temp_dir();
    dir.push("47Service");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Unable to create 47Service temp directory: {error}"))?;
    Ok(dir)
}

fn count_entries(path: &Path) -> usize {
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };

    entries
        .flatten()
        .map(|entry| {
            let path = entry.path();
            if path.is_dir() {
                1 + count_entries(&path)
            } else {
                1
            }
        })
        .sum()
}

#[cfg(target_os = "windows")]
fn set_windows_startup(enabled: bool) -> Result<(), String> {
    let run_key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    if enabled {
        let exe_path = std::env::current_exe()
            .map_err(|error| format!("Unable to resolve current executable: {error}"))?;
        let quoted_path = format!("\"{}\"", exe_path.to_string_lossy());
        let output = Command::new("reg")
            .args(["add", run_key, "/v", "47Service", "/t", "REG_SZ", "/d", &quoted_path, "/f"])
            .output()
            .map_err(|error| format!("Unable to edit Windows startup registry: {error}"))?;
        if output.status.success() {
            return Ok(());
        }

        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let output = Command::new("reg")
        .args(["delete", run_key, "/v", "47Service", "/f"])
        .output()
        .map_err(|error| format!("Unable to edit Windows startup registry: {error}"))?;
    if output.status.success() || String::from_utf8_lossy(&output.stderr).contains("unable to find") {
        return Ok(());
    }

    Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
}

#[cfg(not(target_os = "windows"))]
fn set_windows_startup(_enabled: bool) -> Result<(), String> {
    Err("Launch on startup is only available on Windows.".to_string())
}

#[cfg(target_os = "windows")]
fn get_windows_startup_enabled() -> Result<bool, String> {
    let output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
            "/v",
            "47Service",
        ])
        .output()
        .map_err(|error| format!("Unable to read Windows startup registry: {error}"))?;

    Ok(output.status.success() && String::from_utf8_lossy(&output.stdout).contains("47Service"))
}

#[cfg(not(target_os = "windows"))]
fn get_windows_startup_enabled() -> Result<bool, String> {
    Ok(false)
}

fn timestamp_iso() -> String {
    run_powershell("Get-Date -Format o").unwrap_or_else(|| {
        let seconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0);
        format!("{seconds}")
    })
}

fn timestamp_file_part() -> String {
    timestamp_iso()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
}

fn trim_text(value: &str, max_len: usize) -> String {
    let trimmed = value.trim();
    if trimmed.len() <= max_len {
        return trimmed.to_string();
    }
    format!("{}...", &trimmed[..max_len])
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(icon) = app.default_window_icon().cloned() {
                TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip("47Service")
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|tray, event| {
                        let should_show = matches!(
                            event,
                            TrayIconEvent::DoubleClick {
                                button: MouseButton::Left,
                                ..
                            } | TrayIconEvent::Click {
                                button: MouseButton::Left,
                                button_state: MouseButtonState::Up,
                                ..
                            }
                        );

                        if should_show {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_device_hwid,
            run_smart_action,
            run_premium_smart_action,
            start_game_session,
            restore_game_session,
            execute_cleanup_plan,
            restore_cleanup,
            export_smart_action_report,
            clear_app_cache,
            export_local_logs,
            set_launch_on_startup,
            get_launch_on_startup
        ])
        .run(tauri::generate_context!())
        .expect("error while running 47Service");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logged_reports_include_before_after_and_a_file() {
        let mut report = base_report("session-report", "Session Report", "Test report");
        report.actions_taken.push("Test action".to_string());
        report
            .skipped_actions
            .push("Test skipped action".to_string());
        report.undo_info.push("Test undo info".to_string());

        let logged = log_report(report).expect("report should log");

        assert!(logged.before_snapshot.is_some());
        assert!(logged.after_snapshot.is_some());
        let path = logged.log_path.expect("log path should be set");
        assert!(PathBuf::from(path).exists());
    }

    #[test]
    fn cleanup_safety_guards_protect_user_and_system_paths() {
        assert!(is_protected_path(Path::new(
            r"C:\Users\person\Documents\important.txt"
        )));
        assert!(is_protected_path(Path::new(
            r"C:\Program Files\Example\app.log"
        )));
        assert!(is_protected_path(Path::new(
            r"C:\Users\person\AppData\Roaming\.minecraft\saves\world\level.dat"
        )));
        assert!(is_allowed_cleanup_root(Path::new(
            r"C:\Users\person\AppData\Local\Temp"
        )));
    }

    #[test]
    fn network_and_lag_helpers_create_plain_language_results() {
        assert!(packet_loss_summary(&[Some(
            "Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)"
        )])
        .contains("No packet loss"));
        assert!(packet_loss_summary(&[Some("Request timed out.")]).contains("Packet loss"));
        assert!(
            likely_bottleneck("", "", "", "Request timed out.", "").contains("Network instability")
        );
    }

    #[test]
    fn smart_action_reports_cover_required_workflow_findings() {
        let game = smart_game_prep(false, None).expect("game prep report");
        assert_has_findings(
            &game,
            &[
                "Running games",
                "Heavy background apps",
                "Safe close suggestions",
                "RAM pressure",
                "Disk pressure",
            ],
        );
        assert!(game
            .skipped_actions
            .iter()
            .any(|item| item.contains("Power plan was not changed")));

        let optimizer =
            game_optimizer_session(false, None, None, None).expect("game optimizer report");
        assert_has_findings(
            &optimizer,
            &[
                "Detected games",
                "Selected game",
                "Heavy background apps",
                "RAM pressure",
                "CPU pressure",
                "Disk pressure",
                "Network instability",
                "Safe action suggestions",
            ],
        );
        assert!(optimizer
            .skipped_actions
            .iter()
            .any(|item| item.contains("Timed optimization was not started")));

        let lag = lag_cause_analyzer().expect("lag report");
        assert_has_findings(
            &lag,
            &[
                "CPU",
                "RAM",
                "Disk",
                "Network",
                "Background apps",
                "Likely bottleneck",
            ],
        );

        let network = network_stability_doctor().expect("network report");
        assert_has_findings(
            &network,
            &[
                "Gateway latency",
                "Cloudflare ping",
                "Google ping",
                "DNS response",
                "Packet loss",
            ],
        );
        assert!(network.score.is_some());

        let cleanup = safe_cleanup_plan().expect("cleanup plan");
        assert_has_findings(
            &cleanup,
            &[
                "Cleanup candidates",
                "Exact files",
                "Candidate count",
                "Excluded folders",
            ],
        );
        assert!(cleanup
            .skipped_actions
            .iter()
            .any(|item| item.contains("No files were deleted")));

        let session = session_report().expect("session report");
        assert_has_findings(&session, &["Reports logged", "Latest report"]);
    }

    #[test]
    fn plan_access_blocks_ranked_features() {
        assert!(can_use_feature("network-stability-doctor", "LITE"));
        assert!(can_use_feature("safe-cleanup-plan", "LITE"));
        assert!(can_use_feature("game-optimizer-session", "LITE"));
        assert!(!can_use_feature("smart-game-prep", "LITE"));
        assert!(!can_use_feature("game-optimizer-session-start", "LITE"));
        assert!(!can_use_feature("cleanup-execute", "LITE"));
        assert!(!can_use_feature("session-report", "LITE"));
        assert!(can_use_feature("export-reports", "PRO"));
        assert!(can_use_feature("extra-deep-diagnostics", "LIFETIME"));
        assert!(!can_use_feature("extra-deep-diagnostics", "PRO"));

        let blocked = run_smart_action("smart-game-prep".to_string(), "LITE".to_string());
        assert!(blocked.is_err());

        let game_detection =
            run_smart_action("game-optimizer-session".to_string(), "LITE".to_string())
                .expect("lite game detection should be allowed");
        assert_eq!(game_detection.id, "game-optimizer-session");

        let session_blocked =
            match start_game_session(60, "LITE".to_string(), Some(42), Some("Game".to_string())) {
                Ok(_) => panic!("lite session start should be blocked"),
                Err(error) => error,
            };
        assert!(session_blocked.contains("PRO plan required"));

        let cleanup_scan = run_smart_action("safe-cleanup-plan".to_string(), "LITE".to_string())
            .expect("lite cleanup scan should be allowed");
        assert_eq!(cleanup_scan.id, "safe-cleanup-plan");

        let export_blocked = export_smart_action_report("{}".to_string(), "LITE".to_string())
            .expect_err("lite export should be blocked");
        assert!(export_blocked.contains("PRO plan required"));
    }

    #[test]
    fn lifetime_reports_include_exclusive_extensions() {
        let report = run_smart_action("session-report".to_string(), "LIFETIME".to_string())
            .expect("lifetime session report should run");
        assert_has_findings(
            &report,
            &[
                "Reports logged",
                "Latest report",
                "Extra deep diagnostics",
                "Advanced report history",
            ],
        );
        assert!(report
            .actions_taken
            .iter()
            .any(|action| action.contains("LIFETIME report enrichment")));
    }

    fn assert_has_findings(report: &SmartActionReport, labels: &[&str]) {
        for label in labels {
            assert!(
                report
                    .findings
                    .iter()
                    .any(|finding| finding.label == *label),
                "{} missing finding {label}",
                report.title
            );
        }
    }

    #[test]
    fn smart_action_source_does_not_use_dangerous_tweaks() {
        let source = include_str!("main.rs")
            .split("#[cfg(test)]")
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase();
        let forbidden = [
            ["set-", "mppreference"].concat(),
            ["disable", "realtimemonitoring"].concat(),
            ["reg", " add"].concat(),
            ["reg", " delete"].concat(),
            ["bcd", "edit"].concat(),
            ["netsh int tcp ", "set global"].concat(),
        ];
        for forbidden in forbidden {
            assert!(
                !source.contains(&forbidden),
                "forbidden dangerous tweak found: {forbidden}"
            );
        }
    }
}
