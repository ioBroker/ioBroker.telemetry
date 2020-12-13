import React, {Component} from 'react';
import moment from 'moment';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';

import {MdClose as IconClose} from 'react-icons/md';

import I18n from '@iobroker/adapter-react/i18n';
import Message from '@iobroker/adapter-react/Dialogs/Message';

import TreeTable from '../Components/TreeTable';

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
            0: 'No ignore',
            1: 'Ignore',
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
            error: false,
        };
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
        let data = Object.values(this.props.telemetryObjects).map(object => {
            const custom = object.common.custom ? object.common.custom['telemetry.0'] : {};
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
        return <div><TreeTable 
            data={data} 
            columns={columns}
            disableTree={true}
            disableDelete={true}
            onUpdate={this.props.updateTelemetryObject}
        /></div>;
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
    socket: PropTypes.object.isRequired,
    telemetryObjects: PropTypes.object.isRequired,
};

export default withStyles(styles)(Objects);
