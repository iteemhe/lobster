import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSync } from "@fortawesome/free-solid-svg-icons";
import { Container, Row, Col, Button } from "react-bootstrap";
import { RouteComponentProps, withRouter } from "react-router";
import LeftPanel from "./left-panel/LeftPanel";
import RightPanel from "./right-panel/RightPanel";
import Header from "./Header";
import { Project, Status } from "./SharedTypes";
import moment from "moment";

interface MatchParams {
  sessionid: string;
}

interface Props extends RouteComponentProps<MatchParams> {}

interface State {
  lastUpdated: moment.Moment;
  sessionInfo: {
    sessionid: number;
    name: string;
    exerciseid: number;
    active: boolean;
    created: string;
  };
  projects: Project[];
  statuses: Status[];
}

class Overview extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      lastUpdated: moment(),
      sessionInfo: { sessionid: -1, name: "", exerciseid: -1, active: false, created: "" },
      projects: [],
      statuses: [],
    };

    this.toggleExercise = this.toggleExercise.bind(this);
    this.getUpdatedData = this.getUpdatedData.bind(this);
    this.retrieveProjectData = this.retrieveProjectData.bind(this);
    this.retrieveSessionStatus = this.retrieveSessionStatus.bind(this);
  }

  componentDidMount() {
    const {
      match: {
        params: { sessionid },
      },
    } = this.props;

    const sessionUrl = `/sessions/${sessionid}/`;
    console.log("Get data about session");
    this.setState(
      {
        lastUpdated: moment(),
        sessionInfo: {
          sessionid: 1234,
          name: "My session",
          exerciseid: 5678,
          active: true,
          created: "2020-05-27T18:56:26"
        },
      },
      this.getUpdatedData
    );
    // TODO
    // fetch(sessionUrl, { credentials: "same-origin" })
    //   .then((response) => {
    //     if (!response.ok) throw Error(response.statusText);
    //     return response.json();
    //   })
    //   .then((data) => {
    //     this.setState(
    //       {
    //         lastUpdated: moment(),
    //         sessionInfo: data,
    //       },
    //       this.getUpdatedData
    //     );
    //   });
  }

  getUpdatedData() {
    this.retrieveProjectData();
    this.retrieveSessionStatus();
  }

  retrieveProjectData() {
    const {
      match: {
        params: { sessionid },
      },
    } = this.props;

    this.setState({
      lastUpdated: moment(),
      projects: [
        {
          projectid: 0,
          email: "cmfh0@umich.edu",
          sessionid: 1234,
          exerciseid: 5678,
          lastmodified: "Never",
          status: {},
          filenames: ["file1", "file2", "file3"],
        },
        {
          projectid: 1,
          email: "cmfh1@umich.edu",
          sessionid: 1234,
          exerciseid: 5678,
          lastmodified: "Never",
          status: {},
          filenames: ["file1", "file2", "file3"],
        },
        {
          projectid: 2,
          email: "cmfh2@umich.edu",
          sessionid: 1234,
          exerciseid: 5678,
          lastmodified: "Never",
          status: {},
          filenames: ["file1", "file2", "file3"],
        },
        {
          projectid: 3,
          email: "cmfh3@umich.edu",
          sessionid: 1234,
          exerciseid: 5678,
          lastmodified: "Never",
          status: {},
          filenames: ["file1", "file2", "file3"],
        },
        {
          projectid: 4,
          email: "cmfh4@umich.edu",
          sessionid: 1234,
          exerciseid: 5678,
          lastmodified: "Never",
          status: {},
          filenames: ["file1", "file2", "file3"],
        },
        {
          projectid: 5,
          email: "cmfh5@umich.edu",
          sessionid: 1234,
          exerciseid: 5678,
          lastmodified: "Never",
          status: {},
          filenames: ["file1", "file2", "file3"],
        },
        {
          projectid: 6,
          email: "cmfh6@umich.edu",
          sessionid: 1234,
          exerciseid: 5678,
          lastmodified: "Never",
          status: {},
          filenames: ["file1", "file2", "file3"],
        },
        {
          projectid: 7,
          email: "cmfh7@umich.edu",
          sessionid: 1234,
          exerciseid: 5678,
          lastmodified: "Never",
          status: {},
          filenames: ["file1", "file2", "file3"],
        },
      ],
    });

    // TODO
    // fetch(`/sessions/${sessionid}/projects`, { credentials: "same-origin" })
    //   .then((response) => {
    //     if (!response.ok) throw Error(response.statusText);
    //     return response.json();
    //   })
    //   .then((data) => {
    //     this.setState({
    //       lastUpdated: moment(),
    //       projects: data,
    //     });
    //   });
  }

  retrieveSessionStatus() {
    const {
      match: {
        params: { sessionid },
      },
    } = this.props;

    this.setState({
      lastUpdated: moment(),
      statuses: [{}, {}, {}, {}, {}, {}, {}, {}],
    });

    // TODO
    // fetch(`/sessions/${sessionid}/status`, { credentials: "same-origin" })
    //   .then((response) => {
    //     if (!response.ok) throw Error(response.statusText);
    //     return response.json();
    //   })
    //   .then((data) => {
    //     this.setState({
    //       lastUpdated: moment(),
    //       statuses: data,
    //     });
    //   });
  }

  toggleExercise(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const {
      match: {
        params: { sessionid },
      },
    } = this.props;

    let url = `/sessions/${sessionid}/stop/`;
    if (!this.state.sessionInfo.active) {
      url = `/sessions/${sessionid}/sessions/`;
    }

    console.log(url);
    this.setState((prevState: State) => ({
      sessionInfo: {
        ...prevState.sessionInfo,
        active: !prevState.sessionInfo.active,
      },
    }));
    // TODO
    // fetch(url, { credentials: "same-origin", method: "PATCH" })
    //   .then((response) => {
    //     if (!response.ok) throw Error(response.statusText);
    //     return response.json();
    //   })
    //   .then((data) => {
    //     this.setState({
    //       lastUpdated: moment(),
    //       sessionInfo: data,
    //     });
    //   });
  }

  render() {
    const {
      sessionInfo: { active, exerciseid, created },
      lastUpdated,
      projects,
      statuses,
    } = this.state;
    return (
      <Container fluid className="py-2">
        <Header exerciseid={exerciseid} />
        <Row className="mt-3 pb-1">
          <Col md={12} lg={4}>
            <div className="d-flex justify-content-between">
              <Button onClick={this.toggleExercise}>
                {active ? "Stop Exercise" : "Start Exercise"}
              </Button>
              <div className="d-flex align-items-center">
                <span className="pr-1">
                  Last Updated: {lastUpdated.format("h:mm:ss a")}
                </span>
                <Button variant="outline-success" onClick={this.getUpdatedData}>
                  <FontAwesomeIcon icon={faSync} />
                </Button>
              </div>
            </div>
            <LeftPanel statuses={statuses} created={moment(created)} />
          </Col>
          <Col md={12} lg={8}>
            <RightPanel projects={projects} exerciseId={exerciseid} />
          </Col>
        </Row>
      </Container>
    );
  }
}

export default withRouter(Overview);
