use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Represents the operational SLA status for kitchen items
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SlaStatus {
    /// Well within limits
    OnTime,
    /// Nearing late threshold
    Warning,
    /// Exceeded acceptable wait time
    Late,
}

/// Defines service level agreements for food preparation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreparationSla {
    /// Duration after which warning status is triggered
    pub threshold_warning: Duration,
    /// Duration after which late status is triggered
    pub threshold_late: Duration,
}

impl PreparationSla {
    /// Standard default SLA (4m warning, 8m late).
    #[must_use]
    pub fn default_restaurant() -> Self {
        Self {
            threshold_warning: Duration::from_mins(4),
            threshold_late: Duration::from_mins(8),
        }
    }

    /// Evaluates the current SLA status based on elapsed time.
    #[must_use]
    pub fn evaluate(&self, elapsed: Duration) -> SlaStatus {
        if elapsed >= self.threshold_late {
            SlaStatus::Late
        } else if elapsed >= self.threshold_warning {
            SlaStatus::Warning
        } else {
            SlaStatus::OnTime
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sla_evaluate() {
        let sla = PreparationSla::default_restaurant();
        assert_eq!(sla.evaluate(Duration::from_mins(3)), SlaStatus::OnTime);
        assert_eq!(sla.evaluate(Duration::from_mins(5)), SlaStatus::Warning);
        assert_eq!(sla.evaluate(Duration::from_mins(9)), SlaStatus::Late);
    }
}
