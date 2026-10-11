import { Switch, Route, useLocation } from "react-router-dom";
import SchedulingPage from "./SchedulingPage.jsx";
import ScheduleJobPage from "./ScheduleJobPage.jsx";

/**
 * When opening a job from the board with
 * `history.push({ pathname: "/scheduling/job/:id", state: { background: location } })`,
 * the board stays mounted underneath and the job page renders again as a modal overlay.
 * Direct visits to `/scheduling/job/:id` (no state) still get a full-page job view.
 */
export default function SchedulingEntry() {
  const location = useLocation();
  const background = location.state?.background;

  return (
    <>
      <Switch location={background || location}>
        <Route exact path="/scheduling" component={SchedulingPage} />
        <Route path="/scheduling/job/:jobId" component={ScheduleJobPage} />
      </Switch>
      {background ? (
        <Route path="/scheduling/job/:jobId" component={ScheduleJobPage} />
      ) : null}
    </>
  );
}
