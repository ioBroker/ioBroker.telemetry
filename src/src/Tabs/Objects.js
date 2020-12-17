import React, {Component} from 'react';
import moment from 'moment';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';

import {MdClose as IconClose} from 'react-icons/md';

import I18n from '@iobroker/adapter-react/i18n';
import Message from '@iobroker/adapter-react/Dialogs/Message';

import TreeTable from '@iobroker/adapter-react/Components/TreeTable';

const styles = theme => ({
});

const columns = [
    {
        title: I18n.t('ID'),
        field: 'id',
        editable: 'never'
    },
    {
        title: I18n.t('Name'),
        field: 'name',
        editable: 'never'
    },
    {
        title: I18n.t('Type'),
        field: 'type',
        editable: 'never'
    },
    {
        title: I18n.t('Debounce'),
        field: 'debounce'
    },
    {
        title: I18n.t('Ignore'),
        field: 'ignore',
        lookup: {
            0: I18n.t('No ignore'),
            1: I18n.t('Ignore'),
        }
    },
    {
        title: I18n.t('Last event'),
        field: 'lastEvent',
        editable: 'never'
    },
    {
        title: I18n.t('Events in hour'),
        field: 'eventsInHour',
        editable: 'never'
    },
];

class Objects extends Component {
    constructor(props) {
        super(props);
        this.propertyName = 'resources';

        this.state = {
            showHint: false,
            toast: '',
            alive: false,
            telemetryObjects: [],
        };

        this.props.seocket.getState('system.adapter.' + this.props.adapterName + '.' + this.props.instance + '.alive')
            .then(state => {
                const newState = {alive: state && state.val};
                if (newState.alive) {
                    this.props.socket.sendTo(this.props.adapterName + '.' + this.props.instance, 'browse', null)
                        .then(result => {
                            if (result.result) {
                                this.setState({telemetryObjects: result.result});
                            } else {
                                this.setState({toast: I18n.t('Cannot get list:') + (result.error || 'see ioBroker log')});
                            }
                        });
                } else {
                    this.setState(newState);
                }
            });
    }

    renderToast() {
        if (!this.state.toast) return null;
        return (
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open={true}
                autoHideDuration={6000}
                onClose={() => this.setState({toast: ''})}
                ContentProps={{
                    'aria-describedby': 'message-id',
                }}
                message={<span id="message-id">{this.state.toast}</span>}
                action={[
                    <IconButton
                        key="close"
                        aria-label="Close"
                        color="inherit"
                        className={this.props.classes.close}
                        onClick={() => this.setState({toast: ''})}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />);
    }

    renderHint() {
        if (this.state.showHint) {
            return <Message text={I18n.t('Click now Get new connection certificates to request new temporary password')} onClose={() => this.setState({showHint: false})}/>;
        } else {
            return null;
        }
    }

    render() {
        if (!this.state.alive) {
            return <p>{I18n.t('Please start the instance first!')}</p>;
        }

        let data = Object.values(this.state.telemetryObjects).map(object => {
            const custom = object.common.custom ? object.common.custom[this.props.adapterName + '.' + this.props.instance] : {};
            return {
                id: object._id,
                name: object.common.name,
                type: object.common.role,
                debounce: custom.debounce ? custom.debounce : this.props.native[object.common.role + '_debounce'],
                ignore: custom.ignore ? custom.ignore : 0,
                lastEvent: custom.lastEvent ? moment(custom.lastEvent).format('YYYY-MM-DD HH:mm:ss') : null,
                eventsInHour: custom.eventsInHour ? custom.eventsInHour.length : null,
            }
        });
        console.log(data);
        return <TreeTable
            data={data}
            columns={columns}
            onUpdate={this.props.updateTelemetryObject}
        />;
    }
}

Objects.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    theme: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onChange: PropTypes.func,
    updateTelemetryObject: PropTypes.func,
    socket: PropTypes.object.isRequired
};

export default withStyles(styles)(Objects);
