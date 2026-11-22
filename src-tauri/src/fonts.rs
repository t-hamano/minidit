//! The fonts installed on the computer.

use std::collections::BTreeSet;

/// Family names of the installed fonts, sorted and without duplicates.
pub fn installed_families() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    let names: BTreeSet<String> = db
        .faces()
        .filter_map(|face| {
            face.families
                .iter()
                .find(|(_, language)| *language == fontdb::Language::English_UnitedStates)
                .or_else(|| face.families.first())
                .map(|(name, _)| name.trim().to_string())
        })
        // macOS keeps system UI fonts under names that start with ".".
        .filter(|name| !name.is_empty() && !name.starts_with('.'))
        .collect();
    let mut names: Vec<String> = names.into_iter().collect();
    names.sort_by_key(|name| name.to_lowercase());
    names
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn families_are_sorted_and_unique() {
        let names = installed_families();
        let sorted = names
            .windows(2)
            .all(|pair| pair[0].to_lowercase() <= pair[1].to_lowercase() && pair[0] != pair[1]);
        assert!(sorted, "{names:?}");
    }
}
