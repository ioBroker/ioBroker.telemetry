import React from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import clsx from 'clsx';

import TextField from '@material-ui/core/TextField';

import I18n from '@iobroker/adapter-react/i18n';
import Logo from '@iobroker/adapter-react/Components/Logo';

const styles = theme => ({
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20
    },
    columnSettings: {
        width: 'calc(100% - 370px)',
    },
    selectControl: {
        width: 200,
        paddingBottom: 20,
    }
});

const Options = (props) => {
    return <form className={props.classes.tab}>
        <Logo
            instance={ props.instance }
            common={ props.common }
            native={ props.native }
            onError={ text => {}/*setState({errorText: text})*/ }
            onLoad={ props.onLoad }
        />
        <div className={clsx(props.classes.column, props.classes.columnSettings)}>
            <TextField
                value={props.native.url}
                onChange={e => props.onChange('url', e.target.value)}
                label={I18n.t('URL Server')}
                helperText={I18n.t('Server')}
            />
            <br/>
            <TextField
                value={props.native.sendIntervalSec}
                onChange={e => props.onChange('sendIntervalSec', e.target.value)}
                label={I18n.t('Send interval')}
                helperText={I18n.t('seconds')}
            />
        </div>
    </form>;
}

Options.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(Options);
