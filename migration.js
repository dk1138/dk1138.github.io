/**
 * Retirement Planner Pro - Data Migration Controller
 * Safely upgrades older JSON save states to the current application version.
 */

// Helper function to compare semantic versions (e.g., "10.14.4" vs "11.0.0")
// Returns -1 if v1 < v2, 1 if v1 > v2, and 0 if they are equal
function compareVersions(v1, v2) {
    if (!v1) return -1;
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
    }
    return 0;
}

/**
 * Runs the loaded data through all necessary migrations.
 * @param {Object} data - The parsed JSON data from local storage or file upload.
 * @param {String} currentAppVersion - The current version of the app (e.g., "10.14.4").
 * @returns {Object} - The migrated data object.
 */
export function migrateData(data, currentAppVersion) {
    if (!data) return data;

    // Create a deep copy so we don't mutate the original reference directly
    let migratedData = JSON.parse(JSON.stringify(data));
    let startVersion = migratedData.version || "1.0.0";

    // Skip if data is already from the current or a newer version
    if (compareVersions(startVersion, currentAppVersion) >= 0) {
        return migratedData;
    }

    console.log(`Migrating data from v${startVersion} to v${currentAppVersion}...`);

    // ========================================================================
    // MIGRATION PIPELINE
    // Add new blocks here whenever you make a breaking change to the data schema
    // ========================================================================

    /* EXAMPLE MIGRATION: If you ever change 'rrif_acct' to 'rrif' in version 11.0.0
    if (compareVersions(migratedData.version, "11.0.0") < 0) {
        // Upgrade Inputs
        if (migratedData.inputs && migratedData.inputs.p1_rrif_acct !== undefined) {
            migratedData.inputs.p1_rrif = migratedData.inputs.p1_rrif_acct;
            delete migratedData.inputs.p1_rrif_acct;
        }
        // Upgrade Strategy Arrays
        if (migratedData.strategies && migratedData.strategies.accum) {
            migratedData.strategies.accum = migratedData.strategies.accum.map(s => s === 'rrif_acct' ? 'rrif' : s);
        }
        
        // Update the version tag to show this step is complete
        migratedData.version = "11.0.0"; 
    }
    */

    // Final catch-all: Ensure the version stamp matches the current app version
    migratedData.version = currentAppVersion;
    
    return migratedData;
}
